var util = require('./util');
var assert = require('simple-assert');

var TinyHttpd = require('../tinyhttpd');

const INTERFACE = '127.0.0.1';
const BIND_PORT = '19891';
const TEST_BAD_CONFIG = {
	'basedir': process.cwd() + '/test/03-sessions-base',
	'interface': INTERFACE,
	'port': BIND_PORT,
	'sessions': true,
	'sessions.maxage': 3600 * 24,
	'sessions.domain': 'localhost',
	'sessions.secret': null
};

const TEST_GOOD_CONFIG = {
	'basedir': process.cwd() + '/test/03-sessions-base',
	'interface': INTERFACE,
	'port': BIND_PORT,
	'sessions': true,
	'sessions.maxage': 3600 * 24,
	'sessions.domain': 'localhost',
	'sessions.secret': '03SessionTestingSecret!'	
};

describe("Cookie/Session Management Tests Pt 1", () => {
	var th = null;
	
	before('Starting tinyhttpd', function(done) {
		th = new TinyHttpd(TEST_BAD_CONFIG).then((self) => {
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
	
	it("Ensure sessions are automatically shut off if we don't have a secret", () => {
		assert(! th.config.sessions);
	});
});

describe("Cookie/Session Management Tests Pt 2", () => {
	var th = null;
	
	before('Starting tinyhttpd', function(done) {
		th = new TinyHttpd(TEST_GOOD_CONFIG).then((self) => {
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
	
	it("Ensure sessions are available", () => {
		assert(th.config.sessions === true);
	});
	
	it("Make a request and ensure nothing breaks", (done) => {
		util.get('/', {}).then((resp) => {
			try {
				assert(resp.code == 200, 'HTTP code is not 200');
				assert(resp.body.match(/sessions OK/));
				done();
			} catch(e) {
				done(e.message);
			}
		}, done);			
	});
	   
	var cookie_header = null;
   
    it("Make a request to augment our session", (done) => {
		util.get('/update-session', {}).then((resp) => {
			try {
				assert(resp.code == 200, 'HTTP code is not 200');
				assert(resp.body.match(/session value set /), 'sessions msg not in body');

				assert(resp.headers['set-cookie'], 'No Set-Cookie header present.');
				
//				assert(resp.obj.headers['set-cookie'].length > 0, 'no set-cookie header');
				done();
				
				cookie_header = resp.headers['set-cookie'][0];
			} catch(e) {
				done(e.message);
			}
		}, done);					
	});
	
	it("See if our session data is readable again", (done) => {
		assert(cookie_header);
		
		util.get('/', {}, { 'Cookie': cookie_header }).then((resp) => {
			try {
				assert(resp.code == 200, 'HTTP code is not 200');
				assert(resp.body.match(/sessions OK/), 'session msg not in body');
				assert(resp.body.match(/session value set/), 'session succ set msg not in body');
				done();
			} catch(e) {
				done(e.message);
			}
		}, done);		
	});
});