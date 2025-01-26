'use strict'

const _ = require('lodash');

class ApiConfig {
  /**
   * Initiate with options
   * @param  {Object} options - should have these props:
   * mainkey
   */
  constructor(options = { mainkey: '' }) {
    this.mainkey = '';

    this.set(options);
  }

  /**
   * Return config stored
   * @return {Object} object contains mainkey
   */
  get() {
    let currentConfig = {
      mainkey : this.mainkey,
    };
    return currentConfig;
  }

  /**
   * Set config stored
   * @param {Object} options - object contains [mainkey]
   */
  set(options) {
    let currentConfig = {
      mainkey : this.mainkey
    };
    const parsedOptions = _.pick(options,['mainkey']);
    let mergedConfig = _.merge({},currentConfig,parsedOptions);

    this.mainkey = mergedConfig.mainkey;
  }

  /**
   * @return {String} core api main base url
   */
  getMainBaseUrl() {
    return ApiConfig.WHATSAPP_BASE_URL;
  };
}

// Static vars
ApiConfig.MAIN_BASE_URL = 'http://localhost:4976';

module.exports = ApiConfig;