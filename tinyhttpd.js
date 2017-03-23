var fs = require('fs');
var path = require('path');
var lie = require('lie');
var debug = require('debug')('tinyhttpd');
var spawn = require('child_process').spawn;

var httpd = require('http');
var HttpDispatcher = require('httpdispatcher');


function TinyHttpd(config) {
	this.config = parseConfig(config);
	this.disp   = new HttpDispatcher();
	this.http   = null;
	this.url = 'http://' + [this.config.interface, this.config.port].join(":");
	
	var self = this;
	
	var parseBaseDir = function() { return self.parseBaseDir(); };
	var setUp = function(app) { return self.setUp(app); };
	
	return parseBaseDir().then(setUp).catch((err) => { console.error('err!', err); });
}

TinyHttpd.prototype.parseBaseDir = function() {
	// @TODO Look at the files in our basedir and grab the important defs.
	return lie.resolve({});
};

TinyHttpd.prototype.setUp = function(cnf) {
	// @TODO based on the file structure, build out the dispatch config/mapping.
	return lie.resolve(this);
};

TinyHttpd.prototype.start = function() {
	debug("Starting httpd service");
	return new lie((resolve, reject) => {
		var scope = this;
		
		this.http = httpd.createServer(function (req, res) {
			scope.disp.dispatch(req, res);
		});
		
		if (this.http) {
			this.http.listen(this.config.port, this.config.interface);
			debug(`httpd service listening on ${this.config.port}:${this.config.interface}`);
		} else {
			debug("Failed to create httpd server!");
			reject('createServer failed');
		}
		
		resolve(this);
	});
};

TinyHttpd.prototype.surfTo = function(uri) {
	var url = this.url;
	if (uri) {
		uri = uri.replace(/^\//, '');
		url += "/" + uri;
	} else {
		url += "/";
	}
	
	spawn('open', [ url ]);
}

function defaultConfig() {
	return {
		'interface': '127.0.0.1',
		'port': process.env.PORT ? process.env.PORT : 4101,
		'basedir': path.join(process.cwd(), 'app')
	};
}

function parseConfig(in_config) {
	var config = defaultConfig();
	
	if (in_config) {
		for (var ck in in_config) {
			config[in_config] = in_config[ck];
		}
	}
	
	return config;
}


module.exports = TinyHttpd;