'use strict';

const FtyErrorCodes = require('./ErrorCodes');

const Messages = {
  [FtyErrorCodes.ClientInvalidOption]: (prop, must) => `The ${prop} option must be ${must}`,
  [FtyErrorCodes.ClientNotReady]: action => `The client needs to be logged in to ${action}.`,

  [FtyErrorCodes.TokenInvalid]: 'An invalid token was provided.',
  [FtyErrorCodes.TokenMissing]: 'Request to use token, but token was unavailable to the client.',

  [FtyErrorCodes.WSCloseRequested]: 'WebSocket closed due to user request.',
  [FtyErrorCodes.WSConnectionExists]: 'There is already an existing WebSocket connection.',
  [FtyErrorCodes.WSNotOpen]: (data = 'data') => `WebSocket not open to send ${data}`,

  [FtyErrorCodes.FileNotFound]: file => `File could not be found: ${file}`,

  [FtyErrorCodes.InvalidType]: (name, expected, an = false) => `Supplied ${name} is not a${an ? 'n' : ''} ${expected}.`,
  [FtyErrorCodes.InvalidElement]: (type, name, elem) => `Supplied ${type} ${name} includes an invalid element: ${elem}`,

  [FtyErrorCodes.NotImplemented]: (what, name) => `Method ${what} not implemented on ${name}.`,
};

module.exports = Messages;
