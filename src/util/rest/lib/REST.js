"use strict";

const { Collection } = require("@discordjs/collection");
const { DiscordSnowflake } = require("@sapphire/snowflake");
const { AsyncEventEmitter } = require("@vladfrangu/async_event_emitter");
const { filetypeinfo } = require("magic-bytes.js");
const BurstHandler = require('./handler/BurstHandler.js');
const SequentialHandler = require('./handler/SequentialHandler.js');
const { RequestMethod, RESTEvents } = require('./utils/constants.js');
const { isBufferLike, parseResponse } = require('./utils/utils.js');

class REST extends AsyncEventEmitter {
  /**
   * The {@link https://undici.nodejs.org/#/docs/api/Agent | Agent} for all requests
   * performed by this manager.
   */
  agent = null;
  /**
   * The number of requests remaining in the global bucket
   */
  globalRemaining;
  /**
   * The promise used to wait out the global rate limit
   */
  globalDelay = null;
  /**
   * The timestamp at which the global bucket resets
   */
  globalReset = -1;
  /**
   * API bucket hashes that are cached from provided routes
   */
  hashes = new Collection();
  /**
   * Request handlers created from the bucket hash and the major parameters
   */
  handlers = new Collection();
  #token = null;
  hashTimer;
  handlerTimer;
  options;
  constructor(options = {}) {
    super();
    this.options = { ...DefaultRestOptions, ...options };
    this.globalRemaining = Math.max(1, this.options.globalRequestsPerSecond);
    this.agent = options.agent ?? null;
    this.setupSweepers();
  }
  setupSweepers() {
    const validateMaxInterval = (interval) => {
      if (interval > 144e5) {
        throw new Error("Cannot set an interval greater than 4 hours");
      }
    };

    if (this.options.hashSweepInterval !== 0 && this.options.hashSweepInterval !== Number.POSITIVE_INFINITY) {
      validateMaxInterval(this.options.hashSweepInterval);
      this.hashTimer = setInterval(() => {
        const sweptHashes = new Collection();
        const currentDate = Date.now();
        this.hashes.sweep((val, key) => {
          if (val.lastAccess === -1)
            return false;
          const shouldSweep = Math.floor(currentDate - val.lastAccess) > this.options.hashLifetime;
          if (shouldSweep) {
            sweptHashes.set(key, val);
            this.emit(RESTEvents.Debug, `Hash ${val.value} for ${key} swept due to lifetime being exceeded`);
          }
          return shouldSweep;
        });
        this.emit(RESTEvents.HashSweep, sweptHashes);
      }, this.options.hashSweepInterval);
      this.hashTimer.unref?.();
    }

    if (this.options.handlerSweepInterval !== 0 && this.options.handlerSweepInterval !== Number.POSITIVE_INFINITY) {
      validateMaxInterval(this.options.handlerSweepInterval);
      this.handlerTimer = setInterval(() => {
        const sweptHandlers = new Collection();
        this.handlers.sweep((val, key) => {
          const { inactive } = val;
          if (inactive) {
            sweptHandlers.set(key, val);
            this.emit(RESTEvents.Debug, `Handler ${val.id} for ${key} swept due to being inactive`);
          }
          return inactive;
        });
        this.emit(RESTEvents.HandlerSweep, sweptHandlers);
      }, this.options.handlerSweepInterval);
      this.handlerTimer.unref?.();
    }
  }

  /**
   * Runs a get request from the api
   *
   * @param fullRoute - The full route to query
   * @param options - Optional request options
   */
  async get(fullRoute, options = {}) {
    return this.request({ ...options, fullRoute, method: RequestMethod.Get });
  }

  /**
   * Runs a delete request from the api
   *
   * @param fullRoute - The full route to query
   * @param options - Optional request options
   */
  async delete(fullRoute, options = {}) {
    return this.request({ ...options, fullRoute, method: RequestMethod.Delete });
  }

  /**
   * Runs a post request from the api
   *
   * @param fullRoute - The full route to query
   * @param options - Optional request options
   */
  async post(fullRoute, options = {}) {
    return this.request({ ...options, fullRoute, method: RequestMethod.Post });
  }

  /**
   * Runs a put request from the api
   *
   * @param fullRoute - The full route to query
   * @param options - Optional request options
   */
  async put(fullRoute, options = {}) {
    return this.request({ ...options, fullRoute, method: RequestMethod.Put });
  }

  /**
   * Runs a patch request from the api
   *
   * @param fullRoute - The full route to query
   * @param options - Optional request options
   */
  async patch(fullRoute, options = {}) {
    return this.request({ ...options, fullRoute, method: RequestMethod.Patch });
  }

  /**
   * Runs a request from the api
   *
   * @param options - Request options
   */
  async request(options) {
    const response = await this.queueRequest(options);
    return parseResponse(response);
  }

  /**
   * Sets the default agent to use for requests performed by this manager
   *
   * @param agent - The agent to use
   */
  setAgent(agent) {
    this.agent = agent;
    return this;
  }

  /**
   * Sets the authorization token that should be used for requests
   *
   * @param token - The authorization token to use
   */
  setToken(token) {
    this.#token = token;
    return this;
  }

  /**
   * Queues a request to be sent
   *
   * @param request - All the information needed to make a request
   * @returns The response from the api request
   */
  async queueRequest(request2) {
    const routeId = REST.generateRouteData(request2.fullRoute, request2.method);
    const hash = this.hashes.get(`${request2.method}:${routeId.bucketRoute}`) ?? {
      value: `Global(${request2.method}:${routeId.bucketRoute})`,
      lastAccess: -1
    };
    const handler = this.handlers.get(`${hash.value}:${routeId.majorParameter}`) ?? this.createHandler(hash.value, routeId.majorParameter);
    const { url, fetchOptions } = await this.resolveRequest(request2);
    return handler.queueRequest(routeId, url, fetchOptions, {
      body: request2.body,
      files: request2.files,
      auth: request2.auth !== false,
      signal: request2.signal
    });
  }

  /**
   * Creates a new rate limit handler from a hash, based on the hash and the major parameter
   *
   * @param hash - The hash for the route
   * @param majorParameter - The major parameter for this handler
   * @internal
   */
  createHandler(hash, majorParameter) {
    const queue = majorParameter === BurstHandlerMajorIdKey ? new BurstHandler(this, hash, majorParameter) : new SequentialHandler(this, hash, majorParameter);
    this.handlers.set(queue.id, queue);
    return queue;
  }

  /**
   * Formats the request data to a usable format for fetch
   *
   * @param request - The request data
   */
  async resolveRequest(request2) {
    const { options } = this;
    let query = "";
    if (request2.query) {
      const resolvedQuery = request2.query.toString();
      if (resolvedQuery !== "") {
        query = `?${resolvedQuery}`;
      }
    }
    const headers = {
      ...this.options.headers,
      "User-Agent": `${DefaultUserAgent} ${options.userAgentAppendix}`.trim()
    };
    if (request2.auth !== false) {
      if (!this.#token) {
        throw new Error("Expected token to be set for this request, but none was present");
      }
      headers.Authorization = `${request2.authPrefix ?? this.options.authPrefix} ${this.#token}`;
    }
    if (request2.reason?.length) {
      headers["X-Audit-Log-Reason"] = encodeURIComponent(request2.reason);
    }
    const url = `${options.api}${request2.versioned === false ? "" : `/v${options.version}`}${request2.fullRoute}${query}`;
    let finalBody;
    let additionalHeaders = {};
    if (request2.files?.length) {
      const formData = new FormData();
      for (const [index, file] of request2.files.entries()) {
        const fileKey = file.key ?? `files[${index}]`;
        if (isBufferLike(file.data)) {
          let contentType = file.contentType;
          if (!contentType) {
            const [parsedType] = (0, filetypeinfo)(file.data);
            if (parsedType) {
              contentType = OverwrittenMimeTypes[parsedType.mime] ?? parsedType.mime ?? "application/octet-stream";
            }
          }
          formData.append(fileKey, new Blob([file.data], { type: contentType }), file.name);
        } else {
          formData.append(fileKey, new Blob([`${file.data}`], { type: file.contentType }), file.name);
        }
      }
      if (request2.body != null) {
        if (request2.appendToFormData) {
          for (const [key, value] of Object.entries(request2.body)) {
            formData.append(key, value);
          }
        } else {
          formData.append("payload_json", JSON.stringify(request2.body));
        }
      }
      finalBody = formData;
    } else if (request2.body != null) {
      if (request2.passThroughBody) {
        finalBody = request2.body;
      } else {
        finalBody = JSON.stringify(request2.body);
        additionalHeaders = { "Content-Type": "application/json" };
      }
    }
    const method = request2.method.toUpperCase();
    const fetchOptions = {
      // Set body to null on get / head requests. This does not follow fetch spec (likely because it causes subtle bugs) but is aligned with what request was doing
      body: ["GET", "HEAD"].includes(method) ? null : finalBody,
      headers: { ...request2.headers, ...additionalHeaders, ...headers },
      method,
      // Prioritize setting an agent per request, use the agent for this instance otherwise.
      dispatcher: request2.dispatcher ?? this.agent ?? void 0
    };
    return { url, fetchOptions };
  }

  /**
   * Stops the hash sweeping interval
   */
  clearHashSweeper() {
    clearInterval(this.hashTimer);
  }

  /**
   * Stops the request handler sweeping interval
   */
  clearHandlerSweeper() {
    clearInterval(this.handlerTimer);
  }

  /**
   * Generates route data for an endpoint:method
   *
   * @param endpoint - The raw endpoint to generalize
   * @param method - The HTTP method this endpoint is called without
   * @internal
   */
  static generateRouteData(endpoint, method) {
    if (endpoint.startsWith("/interactions/") && endpoint.endsWith("/callback")) {
      return {
        majorParameter: BurstHandlerMajorIdKey,
        bucketRoute: "/interactions/:id/:token/callback",
        original: endpoint
      };
    }
    const majorIdMatch = /(?:^\/webhooks\/(\d{17,19}\/[^/?]+))|(?:^\/(?:channels|guilds|webhooks)\/(\d{17,19}))/.exec(
      endpoint
    );
    const majorId = majorIdMatch?.[2] ?? majorIdMatch?.[1] ?? "global";
    const baseRoute = endpoint.replaceAll(/\d{17,19}/g, ":id").replace(/\/reactions\/(.*)/, "/reactions/:reaction").replace(/\/webhooks\/:id\/[^/?]+/, "/webhooks/:id/:token");
    let exceptions = "";
    if (method === "DELETE" /* Delete */ && baseRoute === "/channels/:id/messages/:id") {
      const id = /\d{17,19}$/.exec(endpoint)[0];
      const timestamp = DiscordSnowflake.timestampFrom(id);
      if (Date.now() - timestamp > 1e3 * 60 * 60 * 24 * 14) {
        exceptions += "/Delete Old Message";
      }
    }
    return {
      majorParameter: majorId,
      bucketRoute: baseRoute + exceptions,
      original: endpoint
    };
  }
};

module.exports = REST;
