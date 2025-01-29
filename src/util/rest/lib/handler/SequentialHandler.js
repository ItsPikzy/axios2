"use strict";

const { AsyncQueue } = require("@sapphire/async-queue");
const { RESTEvents } = require('../utils/constants.js');
const { normalizeRateLimitOffset, onRateLimit, sleep } = require('../utils/utils.js');
const { handleErrors, incrementInvalidCount, makeNetworkRequest } = require('./Shared.js');

class SequentialHandler {
  /**
   * @param manager - The request manager
   * @param hash - The hash that this RequestHandler handles
   * @param majorParameter - The major parameter for this handler
   */
  constructor(manager, hash, majorParameter) {
    this.manager = manager;
    this.hash = hash;
    this.majorParameter = majorParameter;
    this.id = `${hash}:${majorParameter}`;
  }

  id;
  /**
   * The time this rate limit bucket will reset
   */
  reset = -1;
  /**
   * The remaining requests that can be made before we are rate limited
   */
  remaining = 1;
  /**
   * The total number of requests that can be made before we are rate limited
   */
  limit = Number.POSITIVE_INFINITY;
  /**
   * The interface used to sequence async requests sequentially
   */
  #asyncQueue = new AsyncQueue();
  /**
   * The interface used to sequence sublimited async requests sequentially
   */
  #sublimitedQueue = null;
  /**
   * A promise wrapper for when the sublimited queue is finished being processed or null when not being processed
   */
  #sublimitPromise = null;
  /**
   * Whether the sublimit queue needs to be shifted in the finally block
   */
  #shiftSublimit = false;

  get inactive() {
    return this.#asyncQueue.remaining === 0 && (this.#sublimitedQueue === null || this.#sublimitedQueue.remaining === 0) && !this.limited;
  }
  /**
   * If the rate limit bucket is currently limited by the global limit
   */
  get globalLimited() {
    return this.manager.globalRemaining <= 0 && Date.now() < this.manager.globalReset;
  }
  /**
   * If the rate limit bucket is currently limited by its limit
   */
  get localLimited() {
    return this.remaining <= 0 && Date.now() < this.reset;
  }
  /**
   * If the rate limit bucket is currently limited
   */
  get limited() {
    return this.globalLimited || this.localLimited;
  }
  /**
   * The time until queued requests can continue
   */
  getTimeToReset(routeId) {
    const offset = normalizeRateLimitOffset(this.manager.options.offset, routeId.bucketRoute);
    return this.reset + offset - Date.now();
  }
  /**
   * Emits a debug message
   *
   * @param message - The message to debug
   */
  debug(message) {
    this.manager.emit(RESTEvents.Debug, `[REST ${this.id}] ${message}`);
  }
  /**
   * Delay all requests for the specified amount of time, handling global rate limits
   *
   * @param time - The amount of time to delay all requests for
   */
  async globalDelayFor(time) {
    await sleep(time);
    this.manager.globalDelay = null;
  }

  async queueRequest(routeId, url, options, requestData) {
    let queue = this.#asyncQueue;
    let queueType = 0 /* Standard */;
    if (this.#sublimitedQueue && hasSublimit(routeId.bucketRoute, requestData.body, options.method)) {
      queue = this.#sublimitedQueue;
      queueType = 1 /* Sublimit */;
    }
    await queue.wait({ signal: requestData.signal });
    if (queueType === 0 /* Standard */) {
      if (this.#sublimitedQueue && hasSublimit(routeId.bucketRoute, requestData.body, options.method)) {
        queue = this.#sublimitedQueue;
        const wait = queue.wait();
        this.#asyncQueue.shift();
        await wait;
      } else if (this.#sublimitPromise) {
        await this.#sublimitPromise.promise;
      }
    }
    try {
      return await this.runRequest(routeId, url, options, requestData);
    } finally {
      queue.shift();
      if (this.#shiftSublimit) {
        this.#shiftSublimit = false;
        this.#sublimitedQueue?.shift();
      }
      if (this.#sublimitedQueue?.remaining === 0) {
        this.#sublimitPromise?.resolve();
        this.#sublimitedQueue = null;
      }
    }
  }
  /**
   * The method that actually makes the request to the api, and updates info about the bucket accordingly
   *
   * @param routeId - The generalized api route with literal ids for major parameters
   * @param url - The fully resolved url to make the request to
   * @param options - The fetch options needed to make the request
   * @param requestData - Extra data from the user's request needed for errors and additional processing
   * @param retries - The number of retries this request has already attempted (recursion)
   */
  async runRequest(routeId, url, options, requestData, retries = 0) {
    while (this.limited) {
      const isGlobal = this.globalLimited;
      let limit2;
      let timeout;
      let delay;
      if (isGlobal) {
        const offset2 = normalizeRateLimitOffset(this.manager.options.offset, routeId.bucketRoute);
        limit2 = this.manager.options.globalRequestsPerSecond;
        timeout = this.manager.globalReset + offset2 - Date.now();
        if (!this.manager.globalDelay) {
          this.manager.globalDelay = this.globalDelayFor(timeout);
        }
        delay = this.manager.globalDelay;
      } else {
        limit2 = this.limit;
        timeout = this.getTimeToReset(routeId);
        delay = sleep(timeout);
      }
      const rateLimitData = {
        global: isGlobal,
        method: options.method ?? "get",
        url,
        route: routeId.bucketRoute,
        majorParameter: this.majorParameter,
        hash: this.hash,
        limit: limit2,
        timeToReset: timeout,
        retryAfter: timeout,
        sublimitTimeout: 0,
        scope: "user"
      };
      this.manager.emit("rateLimited" /* RateLimited */, rateLimitData);
      await onRateLimit(this.manager, rateLimitData);
      if (isGlobal) {
        this.debug(`Global rate limit hit, blocking all requests for ${timeout}ms`);
      } else {
        this.debug(`Waiting ${timeout}ms for rate limit to pass`);
      }
      await delay;
    }
    if (!this.manager.globalReset || this.manager.globalReset < Date.now()) {
      this.manager.globalReset = Date.now() + 1e3;
      this.manager.globalRemaining = this.manager.options.globalRequestsPerSecond;
    }
    this.manager.globalRemaining--;
    const method = options.method ?? "get";
    const res = await makeNetworkRequest(this.manager, routeId, url, options, requestData, retries);
    if (res === null) {
      return this.runRequest(routeId, url, options, requestData, ++retries);
    }
    const status = res.status;
    let retryAfter = 0;
    const limit = res.headers.get("X-RateLimit-Limit");
    const remaining = res.headers.get("X-RateLimit-Remaining");
    const reset = res.headers.get("X-RateLimit-Reset-After");
    const hash = res.headers.get("X-RateLimit-Bucket");
    const retry = res.headers.get("Retry-After");
    const scope = res.headers.get("X-RateLimit-Scope") ?? "user";
    const offset = normalizeRateLimitOffset(this.manager.options.offset, routeId.bucketRoute);
    this.limit = limit ? Number(limit) : Number.POSITIVE_INFINITY;
    this.remaining = remaining ? Number(remaining) : 1;
    this.reset = reset ? Number(reset) * 1e3 + Date.now() + offset : Date.now();
    if (retry)
      retryAfter = Number(retry) * 1e3 + offset;
    if (hash && hash !== this.hash) {
      this.debug(["Received bucket hash update", `  Old Hash  : ${this.hash}`, `  New Hash  : ${hash}`].join("\n"));
      this.manager.hashes.set(`${method}:${routeId.bucketRoute}`, { value: hash, lastAccess: Date.now() });
    } else if (hash) {
      const hashData = this.manager.hashes.get(`${method}:${routeId.bucketRoute}`);
      if (hashData) {
        hashData.lastAccess = Date.now();
      }
    }
    let sublimitTimeout = null;
    if (retryAfter > 0) {
      if (res.headers.has("X-RateLimit-Global")) {
        this.manager.globalRemaining = 0;
        this.manager.globalReset = Date.now() + retryAfter;
      } else if (!this.localLimited) {
        sublimitTimeout = retryAfter;
      }
    }
    if (status === 401 || status === 403 || status === 429) {
      incrementInvalidCount(this.manager);
    }
    if (res.ok) {
      return res;
    } else if (status === 429) {
      const isGlobal = this.globalLimited;
      let limit2;
      let timeout;
      if (isGlobal) {
        const offset2 = normalizeRateLimitOffset(this.manager.options.offset, routeId.bucketRoute);
        limit2 = this.manager.options.globalRequestsPerSecond;
        timeout = this.manager.globalReset + offset2 - Date.now();
      } else {
        limit2 = this.limit;
        timeout = this.getTimeToReset(routeId);
      }
      await onRateLimit(this.manager, {
        global: isGlobal,
        method,
        url,
        route: routeId.bucketRoute,
        majorParameter: this.majorParameter,
        hash: this.hash,
        limit: limit2,
        timeToReset: timeout,
        retryAfter,
        sublimitTimeout: sublimitTimeout ?? 0,
        scope
      });
      this.debug(
        [
          "Encountered unexpected 429 rate limit",
          `  Global         : ${isGlobal.toString()}`,
          `  Method         : ${method}`,
          `  URL            : ${url}`,
          `  Bucket         : ${routeId.bucketRoute}`,
          `  Major parameter: ${routeId.majorParameter}`,
          `  Hash           : ${this.hash}`,
          `  Limit          : ${limit2}`,
          `  Retry After    : ${retryAfter}ms`,
          `  Sublimit       : ${sublimitTimeout ? `${sublimitTimeout}ms` : "None"}`,
          `  Scope          : ${scope}`
        ].join("\n")
      );
      if (sublimitTimeout) {
        const firstSublimit = !this.#sublimitedQueue;
        if (firstSublimit) {
          this.#sublimitedQueue = new AsyncQueue();
          void this.#sublimitedQueue.wait();
          this.#asyncQueue.shift();
        }
        this.#sublimitPromise?.resolve();
        this.#sublimitPromise = null;
        await sleep(sublimitTimeout);
        let resolve;
        const promise = new Promise((res2) => resolve = res2);
        this.#sublimitPromise = { promise, resolve };
        if (firstSublimit) {
          await this.#asyncQueue.wait();
          this.#shiftSublimit = true;
        }
      }
      return this.runRequest(routeId, url, options, requestData, retries);
    } else {
      const handled = await handleErrors(this.manager, res, method, url, requestData, retries);
      if (handled === null) {
        return this.runRequest(routeId, url, options, requestData, ++retries);
      }
      return handled;
    }
  }
};

module.exports = SequentialHandler;
