'use strict';

const WebSocket = require('ws');
const EventEmitter = require('node:events');
const PacketHandlers = require('./handlers.js');
const { FantasyError, ErrorCodes } = require('../../errors.js');
const APIUrl = require('../../util/APIUrl.js');
const Events = require('../../util/Events.js');
const Status = require('../../util/Status.js');

/**
 * The WebSocket manager for this client.
 * @extends {EventEmitter}
 */
class WebSocketManager extends EventEmitter {
  constructor(client) {
    super();

    /**
     * The client that instantiated this WebSocketManager
     * @type {Client}
     * @readonly
     * @name WebSocketManager#client
     */
    Object.defineProperty(this, 'client', { value: client });

    /**
     * @type {String}
     * @private
     */
    this.token = '';

    /**
     * The current status of this WebSocketManager
     * @type {Status}
     */
    this.status = Status.Idle;

    /**
     * If this manager was destroyed. It will prevent shards from reconnecting
     * @type {boolean}
     * @private
     */
    this.destroyed = false;

    /**
     * @type {WebSocket}
     * @private
     */
    this._ws = null;
  }

  /**
   * Emits a debug message.
   * @param {string} message The debug message
   * @private
   */
  debug(message) {
    this.client.emit(
      Events.Debug,
      `[WS => 'Manager'] ${message}`,
    );
  }

  /**
   * Connects this manager to the gateway.
   * @private
   */
  async connect() {
    const invalidToken = new FantasyError(ErrorCodes.TokenInvalid);
    if (this._ws && this.token !== this.client.token) {
      await this._ws.destroy({ code: CloseCodes.Normal, reason: 'Login with differing token requested' });
      this._ws = null;
    }

    if (this._ws) {
      console.log("[WS => 'Manager'] Already connect.");
    } else {
      this._ws = new WebSocket(APIUrl.SERVER, {
        headers: {
          'Authorization': `Bearer ${this.client.token}`
        }
      });
      this.token = this.client.token;
      this.attachEvents();
    }
  }

  /**
   * Attaches event handlers to the internal WebSocketShardManager.
   * @private
   */
  attachEvents() {
    this._ws.on('open', () => this.debug('connected.'));
    this._ws.on('error', (e) => {
      this.client.emit(Events.Error, new FantasyError(e));
    })
    this._ws.on('close', () => {
      console.error(new FantasyError(ErrorCodes.WSCloseRequested));
      this.client.emit(Events.Error, new FantasyError(ErrorCodes.WSCloseRequested));
    })
    this._ws.on('message', (message) => {
      const data = JSON.parse(message);
      if (typeof data.events == 'string' && data.value !== 'undefined') {
        if (data.events == 'READY') {
          this.status = Status.Ready;

          this.client.readyTimestamp = Date.now();

          /**
           * Emitted when the client becomes ready to start working.
           * @event Client#ready
           * @param {Client} client The client
           */
          this.client.emit(Events.ClientReady, this.client);
        }

        if (PacketHandlers[data.events]) {
          PacketHandlers[data.events](this.client, data.value);
        }
      }
    });
  }

  /**
   * Destroys this manager and all its shards.
   * @private
   */
  destroy() {
    if (this.destroyed) return;
    // TODO: Make a util for getting a stack
    this.debug(`Manager was destroyed. Called by:\n${new Error().stack}`);
    this.destroyed = true;
    this._ws.terminate();
  }
}

module.exports = WebSocketManager;
