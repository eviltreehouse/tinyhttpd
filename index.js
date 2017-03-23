var debug = require('debug')('tinyhttpd:starter');

var TinyHttpd = require('./tinyhttpd');

var tinyHttpd = new TinyHttpd().then((self) => {
	self.start().then((self) => {
		debug('tinyHttpd started on %s', self.url);
		self.surfTo();
		
	}, (err) => {
		console.error('ERROR starting tinyHttpd', err);
	});
}, (err) => {
	console.error(err);
	process.exit(1);
});