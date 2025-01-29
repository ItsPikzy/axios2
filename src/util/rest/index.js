"use strict";

const version = "2.3.0";
const { Blob } = require("node:buffer");
const { FormData } = require("undici");

const REST = require('./lib/REST.js');

const FantasyAPIError = require('./lib/error/FantasyAPIError.js');
const HTTPError = require('./lib/error/HTTPError.js');
const RateLimitError = require('./lib/error/RateLimitError.js');

const { setDefaultStrategy } = require('./environment.js');

const {
  DefaultUserAgent,
  DefaultUserAgentAppendix,
  DefaultRestOptions,
  RequestMethod,
  RESTEvents,
  BurstHandlerMajorIdKey,
  shouldUseGlobalFetchAndWebSocket
} = require('./lib/utils/constants.js');

const {
  makeURLSearchParams,
  parseResponse,
} = require('./lib/utils/utils.js');

globalThis.FormData ??= FormData;
globalThis.Blob ??= Blob;
setDefaultStrategy(shouldUseGlobalFetchAndWebSocket() ? fetch : makeRequest);

module.exports = {
  version,
  BurstHandlerMajorIdKey,
  DefaultRestOptions,
  DefaultUserAgent,
  DefaultUserAgentAppendix,
  FantasyAPIError,
  HTTPError,
  REST,
  RESTEvents,
  RateLimitError,
  RequestMethod,
  makeURLSearchParams,
  parseResponse
};
