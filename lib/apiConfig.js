'use strict'

const _ = require('lodash');

class ApiConfig {
  /**
   * Initiate with options
   * @param  {Object} options - should have these props:
   * mainKey
   */
  constructor(options = { mainKey: '' }) {
    this.mainKey = '';

    this.set(options);
  }

  /**
   * Return config stored
   * @return {Object} object contains mainKey
   */
  get() {
    let currentConfig = {
      mainKey : this.mainKey,
    };
    return currentConfig;
  }

  /**
   * Set config stored
   * @param {Object} options - object contains [mainKey]
   */
  set(options) {
    let currentConfig = {
      mainKey : this.mainKey
    };
    const parsedOptions = _.pick(options,['mainKey']);
    let mergedConfig = _.merge({},currentConfig,parsedOptions);

    this.mainKey = mergedConfig.mainKey;
  }

  /**
   * @return {String} core api main base url
   */
  getMainBaseUrl() {
    return ApiConfig.MAIN_BASE_URL;
  };
}

// Static vars
ApiConfig.MAIN_BASE_URL = 'http://localhost:4976';

module.exports = ApiConfig;