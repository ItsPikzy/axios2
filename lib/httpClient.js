'use strict'

const axios = require('axios').default;
const MainError = require('./mainError');

/**
 * Wrapper of Axios to do API request to Main API
 * @return {Promise} of API response, or exception during request
 * capable to do HTTP `request`
 */
class HttpClient {
  constructor(parentObj = {}) {
    this.parent = parentObj;
    this.http_client = axios.create();
  }

  request(httpMethod, username, requestUrl, firstParam = {}, secondParam = {}) {
    let headers = {
      'content-type': 'application/json',
      'accept': 'application/json',
      'user-agent': 'main-pikzy/1.0.0'
    };

    let reqBodyPayload = {};
    let reqQueryParam = {};
    if(httpMethod.toLowerCase() == 'get') {
      // GET http request will use first available param as URL Query param
      reqQueryParam = firstParam;
      reqBodyPayload = secondParam;
    } else {
      // Non GET http request will use first available param as JSON payload body
      reqBodyPayload = firstParam;
      reqQueryParam = secondParam;
    }

    // to avoid anonymous function losing `this` context, 
    // can also replaced with arrow-function instead which don't lose context
    let thisInstance = this;
    return new Promise(function(resolve, reject) {
      // Reject if param is not JSON
      if(typeof reqBodyPayload === 'string' || reqBodyPayload instanceof String) {
        try {
          reqBodyPayload = JSON.parse(reqBodyPayload);
        } catch(err) {
          reject(new MainError(`fail to parse 'body parameters' string as JSON. Use JSON string or Object as 'body parameters'. with message: ${err}`));
        }
      }
      // Reject if param is not JSON
      if(typeof reqQueryParam === 'string' || reqQueryParam instanceof String) {
        try {
          reqQueryParam = JSON.parse(reqQueryParam);
        } catch(err) {
          reject(new MainError(`fail to parse 'query parameters' string as JSON. Use JSON string or Object as 'query parameters'. with message: ${err}`));
        }
      }

      thisInstance.http_client({
        method: httpMethod,
        headers: headers,
        url: requestUrl,
        data: reqBodyPayload,
        params: reqQueryParam,
        auth: {
          username: username,
          password: ''
        }
      }).then(function(res) {
        // Reject core API error status code
        if(res.data.hasOwnProperty('status_code') && res.data.status_code >= 400 && res.data.status_code != 407) {
          // 407 is expected get-status API response for `expire` api key, non-standard
          reject(
            new MainError(
              `Server API is returning API error. HTTP status code: ${res.data.status_code}. API response: ${JSON.stringify(res.data)}`,
              res.data.status_code,
              res.data,
              res
            )
          )
        }
        resolve(res.data);
      }).catch(function(err) {
        let res = err.response;
        // Reject API error HTTP status code
        if(typeof res !== 'undefined' && res.status >= 400) {
          reject(
            new MainError(
              `Server API is returning API error. HTTP status code: ${res.status}. API response: ${JSON.stringify(res.data)}`,
              res.status,
              res.data,
              res
            )
          )
        // Reject API undefined HTTP response 
        } else if(typeof res === 'undefined') {
          reject(
            new MainError(
              `Server API request failed. HTTP response not found, likely connection failure, with message: ${JSON.stringify(err.message)}`,
              null,
              null,
              err
            )
          )
        }
        reject(err);
      })
    });
  }
}

module.exports = HttpClient;