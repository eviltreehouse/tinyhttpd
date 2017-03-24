var debug = require('debug')('tinyhttpd:starter');

var TinyHttpd = require('./tinyhttpd');

var tinyHttpd = new TinyHttpd(
	{
		'basedir': process.cwd() + '/app_test'
	}
	).then((self) => {
	self.start().then((self) => {
		debug('tinyHttpd %s started on %s', self.version, self.url);
//		self.surfTo();
		
	}, (err) => {
		console.error('ERROR starting tinyHttpd', err);
	});
}, (err) => {
	console.error(err);
	process.exit(1);
});