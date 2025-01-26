const version = require('./package.json').version;
const Main = require('./lib/Main');
const MainError = require('./lib/mainError');
const Client = {
  version,
  Main,
	MainError 
}

module.exports = Client;