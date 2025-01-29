"use strict";

const RateLimitError = require('../error/RateLimitError.js');
const { RequestMethod } = require('./constants.js');

function serializeSearchParam(value) {
  switch (typeof value) {
    case "string":
      return value;
    case "number":
    case "bigint":
    case "boolean":
      return value.toString();
    case "object":
      if (value === null)
        return null;
      if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value.toISOString();
      }
      if (typeof value.toString === "function" && value.toString !== Object.prototype.toString)
        return value.toString();
      return null;
    default:
      return null;
  }
}

function makeURLSearchParams(options) {
  const params = new URLSearchParams();
  if (!options)
    return params;
  for (const [key, value] of Object.entries(options)) {
    const serialized = serializeSearchParam(value);
    if (serialized !== null)
      params.append(key, serialized);
  }
  return params;
}

async function parseResponse(res) {
  if (res.headers.get("Content-Type")?.startsWith("application/json")) {
    return res.json();
  }
  return res.arrayBuffer();
}

function hasSublimit(bucketRoute, body, method) {
  if (bucketRoute === "/channels/:id") {
    if (typeof body !== "object" || body === null)
      return false;
    if (method !== RequestMethod.Patch)
      return false;
    const castedBody = body;
    return ["name", "topic"].some((key) => Reflect.has(castedBody, key));
  }
  return true;
}

function shouldRetry(error) {
  if (error.name === "AbortError")
    return true;
  return "code" in error && error.code === "ECONNRESET" || error.message.includes("ECONNRESET");
}

async function onRateLimit(manager, rateLimitData) {
  const { options } = manager;
  if (!options.rejectOnRateLimit)
    return;
  const shouldThrow = typeof options.rejectOnRateLimit === "function" ? await options.rejectOnRateLimit(rateLimitData) : options.rejectOnRateLimit.some((route) => rateLimitData.route.startsWith(route.toLowerCase()));
  if (shouldThrow) {
    throw new RateLimitError(rateLimitData);
  }
}

async function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), ms);
  });
}

function isBufferLike(value) {
  return value instanceof ArrayBuffer || value instanceof Uint8Array || value instanceof Uint8ClampedArray;
}

function normalizeRateLimitOffset(offset, route) {
  if (typeof offset === "number") {
    return Math.max(0, offset);
  }
  const result = offset(route);
  return Math.max(0, result);
}

module.exports = {
  serializeSearchParam,
  makeURLSearchParams,
  parseResponse,
  shouldRetry,
  onRateLimit,
  sleep,
  isBufferLike,
  normalizeRateLimitOffset
}