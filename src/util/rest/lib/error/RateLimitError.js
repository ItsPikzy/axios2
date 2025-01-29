"use strict";

class RateLimitError extends Error {
  timeToReset;
  limit;
  method;
  hash;
  url;
  route;
  majorParameter;
  global;
  retryAfter;
  sublimitTimeout;
  scope;

  constructor({
    timeToReset,
    limit,
    method,
    hash,
    url,
    route,
    majorParameter,
    global,
    retryAfter,
    sublimitTimeout,
    scope
  }) {
    super();
    this.timeToReset = timeToReset;
    this.limit = limit;
    this.method = method;
    this.hash = hash;
    this.url = url;
    this.route = route;
    this.majorParameter = majorParameter;
    this.global = global;
    this.retryAfter = retryAfter;
    this.sublimitTimeout = sublimitTimeout;
    this.scope = scope;
  }
  /**
   * The name of the error
   */
  get name() {
    return `${RateLimitError.name}[${this.route}]`;
  }
};

module.exports = RateLimitError;
