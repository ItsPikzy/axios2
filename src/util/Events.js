'use strict';

/**
 * @typedef {Object} Events
 * @property {string} ClientReady ready
 * @property {string} Debug debug
 * @property {string} Error error
 * @property {string} Warn warn
 */

/**
 * @type {Events}
 * @ignore
 */
module.exports = {
  ClientReady: 'ready',
  Debug: 'debug',
  Error: 'error',
  Warn: 'warn',
};
