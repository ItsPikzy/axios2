"use strict";

const { RESTEvents } = require('../utils/constants.js');
const { normalizeRateLimitOffset, onRateLimit, sleep } = require('../utils/utils.js');
const { handleErrors, incrementInvalidCount, makeNetworkRequest } = require('./Shared.js');

class BurstHandler {
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
  inactive = false;

  /**
   * Emits a debug message
   *
   * @param message - The message to debug
   */
  debug(message) {
    this.manager.emit(RESTEvents.Debug, `[REST ${this.id}] ${message}`);
  }

  async queueRequest(routeId, url, options, requestData) {
    return this.runRequest(routeId, url, options, requestData);
  }

  /**
   * The method that actually makes the request to the API, and updates info about the bucket accordingly
   *
   * @param routeId - The generalized API route with literal ids for major parameters
   * @param url - The fully resolved URL to make the request to
   * @param options - The fetch options needed to make the request
   * @param requestData - Extra data from the user's request needed for errors and additional processing
   * @param retries - The number of retries this request has already attempted (recursion)
   */
  async runRequest(routeId, url, options, requestData, retries = 0) {
    const method = options.method ?? "get";
    const res = await makeNetworkRequest(this.manager, routeId, url, options, requestData, retries);
    if (res === null) {
      return this.runRequest(routeId, url, options, requestData, ++retries);
    }
    const status = res.status;
    let retryAfter = 0;
    const retry = res.headers.get("Retry-After");
    const offset = normalizeRateLimitOffset(this.manager.options.offset, routeId.bucketRoute);
    if (retry)
      retryAfter = Number(retry) * 1e3 + offset;
    if (status === 401 || status === 403 || status === 429) {
      incrementInvalidCount(this.manager);
    }
    if (status >= 200 && status < 300) {
      return res;
    } else if (status === 429) {
      const isGlobal = res.headers.has("X-RateLimit-Global");
      const scope = res.headers.get("X-RateLimit-Scope") ?? "user";
      await onRateLimit(this.manager, {
        global: isGlobal,
        method,
        url,
        route: routeId.bucketRoute,
        majorParameter: this.majorParameter,
        hash: this.hash,
        limit: Number.POSITIVE_INFINITY,
        timeToReset: retryAfter,
        retryAfter,
        sublimitTimeout: 0,
        scope
      });
      this.debug(
        [
          "Encountered unexpected 429 rate limit",
          `  Global         : ${isGlobal}`,
          `  Method         : ${method}`,
          `  URL            : ${url}`,
          `  Bucket         : ${routeId.bucketRoute}`,
          `  Major parameter: ${routeId.majorParameter}`,
          `  Hash           : ${this.hash}`,
          `  Limit          : ${Number.POSITIVE_INFINITY}`,
          `  Retry After    : ${retryAfter}ms`,
          `  Sublimit       : None`,
          `  Scope          : ${scope}`
        ].join("\n")
      );
      await sleep(retryAfter);
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

module.exports = BurstHandler;
