var TinyHttpd = require('../tinyhttpd');
var assert = require('simple-assert');
var util = require('./util');
var lie = require('lie');

const INTERFACE = '127.0.0.1';
const BIND_PORT = '19891';
const TEST_CONFIG = {
	'basedir': null,
	'interface': INTERFACE,
	'port': BIND_PORT
};

describe("TinyHttpd deferred rendering tests", () => {
	var th;
	
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
	
	it("Should handle adding manual routes properly", () => {
		th.route("/nondeferred", "get", function(req, res) {
			res.deliver("test/html", "Not-Deferred 123");
		});
		
		th.route("/deferred", "get", function(req, res) {
			return new lie((resolve, reject) => {
				setTimeout(() => {
					res.deliver("test/html", "Deferred 123 after 500ms");
					resolve(true);
				}, 500);
			});
		});		
	});
	
	it("Should handle calling manual routes properly", (done) => {
		util.get('/nondeferred').then((resp) => {
			   assert(resp.code == 200, 'HTTP code was not 200 -- ' + resp.code);
			   assert(resp.body == 'Not-Deferred 123', 'Returned content was not as expected.');
				done();
	   	}, done)
			.catch((err) => { done(err) })
		;
	});
	
	it("Should handle calling deferred routes properly", (done) => {
		util.get('/deferred').then((resp) => {
			   assert(resp.code == 200, 'HTTP code was not 200 -- ' + resp.code);
			   assert(resp.body == 'Deferred 123 after 500ms', 'Returned content was not as expected.');
				done();
	   	}, done)
			.catch((err) => { done(err) })
		;
		
	});
	
	
});

