'use strict'

const { URL } = require('url');
const version = require('./package.json').version;
const HttpClient = require('./lib/httpClient');
const ORIGINAL_URL = 'http://localhost:4976';

/**
 * Main object used to do request to Server Main API
 */
class Axios2 {
  constructor() {
    this.version = version;
    this.httpClient = new HttpClient(this);
  }

  /**
   * @param  {Object} parameter - object of Main API JSON body as parameter
   * @return {Promise} - Promise contains Object from JSON decoded response
   */
  get(path, param = {}) {
    let apiUrl = this.getMainBaseUrl(path);
    let responsePromise = this.httpClient.request(
      'get',
      null,
      apiUrl,
      param);
    return responsePromise;
  }

  /**
   * @param  {Object} parameter - object of Main API JSON body as parameter
   * @return {Promise} - Promise contains Object from JSON decoded response
   */
  post(path, param = {}) {
    let apiUrl = this.getMainBaseUrl(path);
    let responsePromise = this.httpClient.request(
      'post',
      null,
      apiUrl,
      param);
    return responsePromise;
  }

  /**
   * @param  {Object} parameter - object of Main API JSON body as parameter
   * @return {Promise} - Promise contains Object from JSON decoded response
   */
  put(path, param = {}) {
    let apiUrl = this.getMainBaseUrl(path);
    let responsePromise = this.httpClient.request(
      'put',
      null,
      apiUrl,
      param);
    return responsePromise;
  }

  /**
   * @param  {Object} parameter - object of Main API JSON body as parameter
   * @return {Promise} - Promise contains Object from JSON decoded response
   */
  delete(path, param = {}) {
    let apiUrl = this.getMainBaseUrl(path);
    let responsePromise = this.httpClient.request(
      'delete',
      null,
      apiUrl,
      param);
    return responsePromise;
  }

  /**
   * @param {String} newPath - add new path or not
   * @return {String} core api base url
   */
  getMainBaseUrl(newPath = '/') {
    const originalUrl = new URL(ORIGINAL_URL);
    originalUrl.pathname = `${originalUrl.pathname}/${newPath}`;
    return originalUrl.toString().replace(/([^:]\/)\/+/g, "$1");
  }
}

module.exports = Axios2;