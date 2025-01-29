"use strict";

function isErrorGroupWrapper(error) {
  return Reflect.has(error, "_errors");
}

function isErrorResponse(error) {
  return typeof Reflect.get(error, "message") === "string";
}

class FantasyAPIError extends Error {
  /**
   * @param rawError - The error reported by Fantasy
   * @param code - The error code reported by Fantasy
   * @param status - The status code of the response
   * @param method - The method of the request that erred
   * @param url - The url of the request that erred
   * @param bodyData - The unparsed data for the request that errored
   */
  constructor(rawError, code, status, method, url, bodyData) {
    super(FantasyAPIError.getMessage(rawError));
    this.rawError = rawError;
    this.code = code;
    this.status = status;
    this.method = method;
    this.url = url;
    this.requestBody = { files: bodyData.files, json: bodyData.body };
  }

  requestBody;

  /**
   * The name of the error
   */
  get name() {
    return `${FantasyAPIError.name}[${this.code}]`;
  }

  static getMessage(error) {
    let flattened = "";
    if ("code" in error) {
      if (error.errors) {
        flattened = [...this.flattenFantasyError(error.errors)].join("\n");
      }
      return error.message && flattened ? `${error.message}
${flattened}` : error.message || flattened || "Unknown Error";
    }
    return error.error_description ?? "No Description";
  }

  static *flattenFantasyError(obj, key = "") {
    if (isErrorResponse(obj)) {
      return yield `${key.length ? `${key}[${obj.code}]` : `${obj.code}`}: ${obj.message}`.trim();
    }
    for (const [otherKey, val] of Object.entries(obj)) {
      const nextKey = otherKey.startsWith("_") ? key : key ? Number.isNaN(Number(otherKey)) ? `${key}.${otherKey}` : `${key}[${otherKey}]` : otherKey;
      if (typeof val === "string") {
        yield val;
      } else if (isErrorGroupWrapper(val)) {
        for (const error of val._errors) {
          yield* this.flattenFantasyError(error, nextKey);
        }
      } else {
        yield* this.flattenFantasyError(val, nextKey);
      }
    }
  }
};
