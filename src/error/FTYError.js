'use strict';

// Heavily inspired by node's `internal/errors` module
const ErrorCodes = require('./ErrorCodes');
const Messages = require('./Messages');

/**
 * Extend an error of some sort into a FantasyError.
 * @param {Error} Base Base error to extend
 * @returns {FantasyError}
 * @ignore
 */
function makeFantasyError(Base) {
  return class FantasyError extends Base {
    constructor(code, ...args) {
      super(message(code, args));
      this.code = code;
      Error.captureStackTrace?.(this, FantasyError);
    }

    get name() {
      return `${super.name} [${this.code}]`;
    }
  };
}

/**
 * Format the message for an error.
 * @param {string} code The error code
 * @param {Array<*>} args Arguments to pass for util format or as function args
 * @returns {string} Formatted string
 * @ignore
 */
function message(code, args) {
  if (!(code in ErrorCodes)) throw new Error('Error code must be a valid FantasyErrorCodes');
  const msg = Messages[code];
  if (!msg) throw new Error(`No message associated with error code: ${code}.`);
  if (typeof msg === 'function') return msg(...args);
  if (!args?.length) return msg;
  args.unshift(msg);
  return String(...args);
}

module.exports = {
  FantasyError: makeFantasyError(Error),
  FantasyTypeError: makeFantasyError(TypeError),
  FantasyRangeError: makeFantasyError(RangeError),
};
