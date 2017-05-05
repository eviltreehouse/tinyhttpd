var util = require('./util');
var assert = require('simple-assert');

var TinyHttpd = require('../tinyhttpd');

const INTERFACE = '127.0.0.1';
const BIND_PORT = '19891';
const TEST_CONFIG = {
	'basedir': process.cwd() + '/test/02-test-base',
	'interface': INTERFACE,
	'port': BIND_PORT
};

describe("Parsing/Providing Tests", () => {
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
	
	it("Should pass parsed URI parameters to handler modules", (done) => {
		util.get('/checkquery?qv=455?qv2=919', {}).then((resp) => {
			try {
				assert(resp.code == 200, 'HTTP code is not 200');
				assert(resp.body.match(/qv is 455/), 'body is not as expected: ' + resp.body);
				done();
			} catch(e) {
				done(e.message);
			}
		}, done);		
	});
	
	it("Should serve requests that involve handler modules and EJS", (done) => {
		util.get('/', {}).then((resp) => {
			try {
				assert(resp.code == 200, 'HTTP code is not 200');
				assert(resp.body.match(/foobar sanchez 123/));
				done();
			} catch(e) {
				done(e.message);
			}
		}, done);
	});	
	
	it("Should serve requests that involve handler modules and EJS (w/ includes)", (done) => {
		util.get('/', {}).then((resp) => {
			try {
				assert(resp.code == 200, 'HTTP code is not 200');
				assert(resp.body.match(/Included\:true/));
				assert(resp.body.match(/Included Subdir\:true/));
				done();
			} catch(e) {
				done(e.message);
			}
		}, done);
	});
	
	it("Should serve requests that involve handler modules and Markdown", (done) => {
		util.get('/markdown', {}).then((resp) => {
			try {
				assert(resp.code == 200, 'HTTP code is not 200');
				assert(resp.body.match(/\<strong\>/), 'body did not contain expected HTML tags');
				done();
			} catch (e) {
				done(e.message);
			}
		}, done);
	});
	
	it("Should serve requests that involve handler modules and EJS -> Markdown", (done) => {
		util.get('/ejsmd', {}).then((resp) => {
			try {
				assert(resp.code == 200, 'HTTP code is not 200');
				assert(resp.body.match(/Title/), 'body did not contain expected interpolated output');
				assert(resp.body.match(/\<strong\>/), 'body did not contain expected HTML tags');
				done();
			} catch (e) {
				done(e.message);
			}
		}, done);
	});	
	
	it("Should be able to serve handlers within subdirs", (done) => {
		util.get('/sd/', {}).then((resp) => {
			try {
				assert(resp.code == 200, 'Http code is not 200');
				assert(resp.body.match(/In subdir/), 'Body not as expected');
				done();
			} catch(e) {
				done(e.message);
			}
		});
	});
	
	it("Should be able to serve index handlers within subdirs w/o leading slash", (done) => {
		util.get('/sd', {}).then((resp) => {
			try {
				assert(resp.code == 200, 'Http code is not 200');
				assert(resp.body.match(/In subdir/), 'Body not as expected');
				done();
			} catch(e) {
				done(e.message);
			}
		});
	});	
	
	it("Should be able to access provisions from handler modules", (done) => {
		th.provide('secret', 'sosecret');
		util.get('/checkmy', {}).then((resp) => {
			try {
				assert(resp.code == 200, 'HTTP code is not 200');
				assert(resp.body.match(/My secret is sosecret/), 'Body is not as expected');
				done();
			} catch(e) {
				done(e.message);
			}
		}, done);		
	});
	
	it("Should be able to access provisions from within views directly", (done) => {
		th.provide('secret', 'sosecret');
		util.get('/checkmy-view', {}).then((resp) => {
			try {
				assert(resp.code == 200, 'HTTP code is not 200');
				assert(resp.body.match(/My secret is sosecret/), 'Body is not as expected');
				done();
			} catch(e) {
				done(e.message);
			}
		}, done);		
	});	
	
	it("Should be able to handle define()s from within modules", (done) => {
		util.get('/test-define', { tv: 123 }).then((resp) => {
			try {
				assert(resp.code == 200, 'HTTP code is not 200');
				assert(resp.body.match(/v is 123/));
				done();
			} catch(e) {
				done(e.message);
			}
		});
	});
	
	it("Should be able to handle define()s from within modules w/o caching them", (done) => {
		util.get('/test-define', { tv: 105 }).then((resp) => {
			try {
				assert(resp.code == 200, 'HTTP code is not 200');
				assert(resp.body.match(/v is 105/));
				done();
			} catch(e) {
				done(e.message);
			}
		});
	});
	
	
	it("Should be able to compile LESS on-the-fly and serve standard CSS", (done) => {
		util.get('/test.css', {}).then((resp) => {
			try {
				assert(resp.code == 200, 'HTTP code is not 200');
				assert(resp.headers['content-type'] == 'text/css', 'Content type is ' + resp.headers['content-type']);
				assert(resp.body.match(/color: \#900;/), 'Body is not as expected');
				done();
			} catch(e) {
				done(e.message);
			}
		}, done);		
	});
	
	it("Should be able to catch Errors generated in the handler code", (done) => {
		// define a custom fatal error handler
		th.fatal((err, req, res) => {
			res.writeHead(500, { 'content-type': 'text/plain' });
			res.write('Server-side Fatal Error');
		});
		
		util.get('/throw-error').then((resp) => {
			try {
				assert(resp.code == 500, 'HTTP code is not 500');
				assert(resp.body == 'Server-side Fatal Error');
				done();
			} catch(e) {
				done.message;
			}
		}, done);
	});
});