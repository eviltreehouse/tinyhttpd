var util = require('./util');
var assert = require('simple-assert');

var TinyHttpd = require('../tinyhttpd');

const INTERFACE = '127.0.0.1';
const BIND_PORT = '19891';
const TEST_CONFIG = {
	'basedir': null,
	'interface': INTERFACE,
	'port': BIND_PORT
};

describe("Base httpd responsibilites", () => {
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
	})
	
	it("Should serve requests", (done) => {
		util.get('/', {}).then((resp) => {
			try {
				assert(resp.code == 404, 'HTTP code is not 404');
				done();
			} catch(e) {
				done(e.message);
			}
		}, done);
	});
	
	it("Should let us establish a static route and read from it", function(done) {
		th.route('/', 'get', function(req, res) { 
			res.deliver('text/plain', 'Hello');
		});
		
		util.get('/', {}).then(function(resp) {
			try {
				assert(resp.code == 200, 'HTTP code is not 200');
				assert(resp.body == 'Hello', 'Body is not "Hello"');
				
				util.get('/should-be-404', {}).then(function(resp) {
					try {
						assert(resp.code == 404, 'HTTP code is not 404');
						done();
					} catch(e) {
						done(e.message);
					}
				});
			} catch(e) {
				done(e.message);
			}
			
//			done();
		}, done);
	})
});