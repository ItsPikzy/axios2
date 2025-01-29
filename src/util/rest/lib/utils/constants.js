"use strict";

const { getDefaultStrategy } = require('../../environment.js');

function getUserAgentAppendix() {
  if (typeof globalThis.EdgeRuntime !== "undefined") {
    return "Vercel-Edge-Functions";
  }
  if (typeof globalThis.R2 !== "undefined" && typeof globalThis.WebSocketPair !== "undefined") {
    return "Cloudflare-Workers";
  }
  if (typeof globalThis.Netlify !== "undefined") {
    return "Netlify-Edge-Functions";
  }
  if (typeof globalThis.process !== "object") {
    if (typeof globalThis.navigator === "object") {
      return globalThis.navigator.userAgent;
    }
    return "UnknownEnvironment";
  }
  if ("versions" in globalThis.process) {
    if ("deno" in globalThis.process.versions) {
      return `Deno/${globalThis.process.versions.deno}`;
    }
    if ("bun" in globalThis.process.versions) {
      return `Bun/${globalThis.process.versions.bun}`;
    }
    if ("node" in globalThis.process.versions) {
      return `Node.js/${globalThis.process.versions.node}`;
    }
  }
  return "UnknownEnvironment";
};

function shouldUseGlobalFetchAndWebSocket() {
  if (typeof globalThis.process === "undefined") {
    return "fetch" in globalThis && "WebSocket" in globalThis;
  }
  if ("versions" in globalThis.process) {
    return "deno" in globalThis.process.versions || "bun" in globalThis.process.versions;
  }
  return false;
};

const DefaultUserAgent = `FantasyClient v1.0.0`;
const DefaultUserAgentAppendix = getUserAgentAppendix();
const DefaultRestOptions = {
  agent: null,
  api: "https://api.rmtid.xyz",
  authPrefix: "Bot",
  headers: {},
  invalidRequestWarningInterval: 0,
  globalRequestsPerSecond: 50,
  offset: 50,
  rejectOnRateLimit: null,
  retries: 3,
  timeout: 15e3,
  userAgentAppendix: DefaultUserAgentAppendix,
  version: "1",
  hashSweepInterval: 144e5,
  // 4 Hours
  hashLifetime: 864e5,
  // 24 Hours
  handlerSweepInterval: 36e5,
  // 1 Hour
  async makeRequest(...args) {
    return getDefaultStrategy()(...args);
  }
};

const RequestMethod = {
  Delete: "DELETE",
  Get: "GET",
  Patch: "PATCH",
  Post: "POST",
  Put: "PUT"
};

const RESTEvents = {
  Debug: "restDebug",
  HandlerSweep: "handlerSweep",
  HashSweep: "hashSweep",
  InvalidRequestWarning: "invalidRequestWarning",
  RateLimited: "rateLimited",
  Response: "response"
};

const BurstHandlerMajorIdKey = "burst";

module.exports = {
  shouldUseGlobalFetchAndWebSocket,
  DefaultUserAgent,
  DefaultUserAgentAppendix,
  DefaultRestOptions,
  RequestMethod,
  RESTEvents,
  BurstHandlerMajorIdKey
};
