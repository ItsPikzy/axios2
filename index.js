const version = require('./package.json').version;
const Main = require('./lib/index');
const MainError = require('./lib/mainError');
const Client = {
  version,
  Main,
	MainError 
}

module.exports = Client;