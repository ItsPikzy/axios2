"use strict";

const { RESTEvents } = require('../utils/constants.js');
const { parseResponse, shouldRetry } = require('../utils/utils.js');
const FantasyAPIError = require('../error/FantasyAPIError.js');
const HTTPError = require('../error/HTTPError.js');

var invalidCount = 0;
var invalidCountResetTime = null;

function incrementInvalidCount(manager) {
  if (!invalidCountResetTime || invalidCountResetTime < Date.now()) {
    invalidCountResetTime = Date.now() + 1e3 * 60 * 10;
    invalidCount = 0;
  }
  invalidCount++;
  const emitInvalid = manager.options.invalidRequestWarningInterval > 0 && invalidCount % manager.options.invalidRequestWarningInterval === 0;
  if (emitInvalid) {
    manager.emit(RESTEvents.InvalidRequestWarning, {
      count: invalidCount,
      remainingTime: invalidCountResetTime - Date.now()
    });
  }
}

async function makeNetworkRequest(manager, routeId, url, options, requestData, retries) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), manager.options.timeout);
  if (requestData.signal) {
    if (requestData.signal.aborted)
      controller.abort();
    else
      requestData.signal.addEventListener("abort", () => controller.abort());
  }
  let res;
  try {
    res = await manager.options.makeRequest(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (!(error instanceof Error))
      throw error;
    if (shouldRetry(error) && retries !== manager.options.retries) {
      return null;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  if (manager.listenerCount(RESTEvents.Response)) {
    manager.emit(
      RESTEvents.Response,
      {
        method: options.method ?? "get",
        path: routeId.original,
        route: routeId.bucketRoute,
        options,
        data: requestData,
        retries
      },
      res instanceof Response ? res.clone() : { ...res }
    );
  }
  return res;
}

async function handleErrors(manager, res, method, url, requestData, retries) {
  const status = res.status;
  if (status >= 500 && status < 600) {
    if (retries !== manager.options.retries) {
      return null;
    }
    throw new HTTPError(status, res.statusText, method, url, requestData);
  } else {
    if (status >= 400 && status < 500) {
      if (status === 401 && requestData.auth) {
        manager.setToken(null);
      }
      const data = await parseResponse(res);
      throw new FantasyAPIError(data, "code" in data ? data.code : data.error, status, method, url, requestData);
    }
    return res;
  }
}

module.exports = {
  incrementInvalidCount,
  makeNetworkRequest,
  handleErrors
}