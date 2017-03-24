var assert = require('simple-assert');
var util = require('./util');

const INTERFACE = '127.0.0.1';
const BIND_PORT = '19891';
const TEST_CONFIG = {
	'basedir': null,
	'interface': INTERFACE,
	'port': BIND_PORT
};

describe("TinyHttpd baseline tests", () => {
	var th;
	it("Should require() properly", () => {
		var _th = require('../tinyhttpd');
		assert(typeof _th == 'function');
	});
	
	it("Should instance properly", (done) => {
		var TinyHttpd = new require('../tinyhttpd');
		var _th = new TinyHttpd(TEST_CONFIG);
		
		assert(_th);
		_th.then(() => {
			done();
		});
	});	
});

