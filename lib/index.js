'use strict'

const ApiConfig = require('./apiConfig');
const HttpClient = require('./httpClient');

/**
 * Main object used to do request to Server Main API
 */
class Main {
  constructor(options = { mainKey: '' }) {
    this.apiConfig = new ApiConfig(options);
    this.httpClient = new HttpClient(this);
  }

  /**
   * @param  {Object} parameter - object of Main API JSON body as parameter
   * @return {Promise} - Promise contains Object from JSON decoded response
   */
  get(path, param = {}) {
    let apiUrl = this.apiConfig.getMainBaseUrl()+`/${path}`;
    let responsePromise = this.httpClient.request(
      'get',
      this.apiConfig.get().mainKey,
      apiUrl,
      param);
    return responsePromise;
  }

  /**
   * @param  {Object} parameter - object of Main API JSON body as parameter
   * @return {Promise} - Promise contains Object from JSON decoded response
   */
  post(path, param = {}) {
    let apiUrl = this.apiConfig.getMainBaseUrl()+`/${path}`;
    let responsePromise = this.httpClient.request(
      'post',
      this.apiConfig.get().mainKey,
      apiUrl,
      param);
    return responsePromise;
  }

  /**
   * @param  {Object} parameter - object of Main API JSON body as parameter
   * @return {Promise} - Promise contains Object from JSON decoded response
   */
  put(path, param = {}) {
    let apiUrl = this.apiConfig.getMainBaseUrl()+`/${path}`;
    let responsePromise = this.httpClient.request(
      'put',
      this.apiConfig.get().mainKey,
      apiUrl,
      param);
    return responsePromise;
  }

  /**
   * @param  {Object} parameter - object of Main API JSON body as parameter
   * @return {Promise} - Promise contains Object from JSON decoded response
   */
  delete(path, param = {}) {
    let apiUrl = this.apiConfig.getMainBaseUrl()+`/${path}`;
    let responsePromise = this.httpClient.request(
      'delete',
      this.apiConfig.get().mainKey,
      apiUrl,
      param);
    return responsePromise;
  }
}

module.exports = Main;