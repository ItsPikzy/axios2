"use strict";

class HTTPError extends Error {
  /**
   * @param status - The status code of the response
   * @param statusText - The status text of the response
   * @param method - The method of the request that erred
   * @param url - The url of the request that erred
   * @param bodyData - The unparsed data for the request that errored
   */
  constructor(status, statusText, method, url, bodyData) {
    super(statusText);
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
    return `${HTTPError.name}`;
  }
};

module.exports = HTTPError;
