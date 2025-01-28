'use strict';

/**
 * @typedef {Object} FantasyErrorCodes

 * @property {'ClientInvalidOption'} ClientInvalidOption
 * @property {'ClientNotReady'} ClientNotReady

 * @property {'TokenInvalid'} TokenInvalid
 * @property {'TokenMissing'} TokenMissing

* @property {'WSCloseRequested'} WSCloseRequested
 * <warn>This property is deprecated.</warn>
 * @property {'WSConnectionExists'} WSConnectionExists
 * <warn>This property is deprecated.</warn>
 * @property {'WSNotOpen'} WSNotOpen
 * <warn>This property is deprecated.</warn>
 * @property {'FileNotFound'} FileNotFound

 * @property {'InvalidType'} InvalidType
 * @property {'InvalidElement'} InvalidElement

 * @property {'NotImplemented'} NotImplemented
 */

const keys = [
  'ClientInvalidOption',
  'ClientNotReady',

  'TokenInvalid',
  'TokenMissing',

  'WSCloseRequested',
  'WSConnectionExists',
  'WSError',
  'WSNotOpen',

  'FileNotFound',

  'InvalidType',
  'InvalidElement',

  'NotImplemented',
];

/**
 * @type {FantasyErrorCodes}
 * @ignore
 */
module.exports = Object.fromEntries(keys.map(key => [key, key]));
