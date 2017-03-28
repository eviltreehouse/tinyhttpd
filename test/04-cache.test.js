var util = require('./util');
var assert = require('simple-assert');

var TinyHttpd = require('../tinyhttpd');

const INTERFACE = '127.0.0.1';
const BIND_PORT = '19891';
const TEST_CONFIG = {
	'basedir': process.cwd() + '/test/04-cache-base',
	'interface': INTERFACE,
	'port': BIND_PORT,
	'cache_less': true,
	'cache_views': true
};

describe("Caching Feature Tests", () => {
	var th = null;
	
	before('Starting tinyhttpd', function(done) {
		th = new TinyHttpd(TEST_CONFIG).then((self) => {
			th = self;
			
			th.start().then(() => {
				done();	
			}, done) 
		}, done);
	});
	
	after('Stopping tinyhttpd', function(done) {
		th.stop().then(() => {
			th = null;
			done();
		}, done);
	});
	
	it("Should init and start up", () => {
		assert(th.started);
	});
	
	it("Render our LESS file w/ the first request", () => {
		util.get('/less.css', {}, (resp) => {
			assert(resp.body.match('/color\: \#900/'));
		});
	});
	
	it("Render our LESS file w/ the second request, which should be cached", () => {
		util.get('/less.css', {}, (resp) => {
			assert(resp.body.match(/color\: \#900/));
			assert(resp.body.match(/resolved from cache/));
		});
	});
	
	it("Render our EJS file and cache it", (done) => {
		util.get('/cache-test').then((resp) => {
			assert(resp.code == 200, 'HTTP code not 200');
			assert(resp.body.match(/should be cached/), 'body is not as expected ' + resp.body);
			done();
		}).catch((e) => {
			done(e.message);
		});
	});
	
	it("Render our EJS file and use the cached version", () => {
		util.get('/cache-test').then((resp) => {
			assert(resp.body.match(/should be cached/));
			assert(Object.keys(th._cache.views).length == 1);
			done();
		}).catch((e) => {
			done(e.message);
		});		
	});
});