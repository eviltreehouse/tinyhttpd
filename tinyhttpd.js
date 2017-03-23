var fs = require('fs');
var path = require('path');
var lie = require('lie');
var debug = require('debug')('tinyhttpd:main');
var spawn = require('child_process').spawn;

var httpd = require('http');
var HttpDispatcher = require('httpdispatcher');


function TinyHttpd(config) {
	this.config = parseConfig(config);
	this.disp   = new HttpDispatcher();
	this.http   = null;
	this.url = 'http://' + [this.config.interface, this.config.port].join(":");
	
	var self = this;
	
	var parseBaseDir = function() { return self.parseBaseDir('', false); };
	var setUp = function(app) { return self.setUp(app); };
	
	return parseBaseDir().then(setUp).catch((err) => { console.error('err!', err); });
}

TinyHttpd.prototype.parseBaseDir = function(root, sub_dir) {
	// @TODO Look at the files in our basedir and grab the important defs.
	var self = this;
	
	var loaded = [];
	
		var fpath = path.join(this.config.basedir, root);
		debug("fpath => %s", fpath);
		
		var files = fs.readdirSync(fpath);
		
		files.forEach(function(v) {
			debug("%s/%s", root, v);
			var st = fs.statSync(fpath + "/" + v);
			if (st.isFile() && isValidHandler(v)) {
				loaded.push([ root, v ]);
			} else if (st.isDirectory()) {
				debug("Traversing.. %s", v);
				var hs = self.parseBaseDir(path.join(root, v), true);
				loaded = loaded.concat(hs);
			}
		});
		
		return sub_dir ? loaded : lie.resolve(loaded);
//	return lie.resolve({});
};

TinyHttpd.prototype.setUp = function(cnf) {
	for (var hi in cnf) {
		debug(cnf[hi]);
		
		this.register(cnf[hi][0], cnf[hi][1]);
	}
	
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

TinyHttpd.prototype.register = function(ext_path, fn) {
	debug("register => %s %s", ext_path, fn);
	
	hf = fn.replace(/\.js$/, '');
	def = /^(.*?)\.(.*?)$/.exec(hf);
	var mpath = def[1];
	var method = def[2];
	if (! mpath || ! method) return;
	
	var h = null;
	var hp = path.join(this.config.basedir, ext_path, fn);
	
	try {
		h = require(hp);
	} catch(e) {
		debug("Could not load %s", hp);
	};
	
	var rmeth = {
		'get':  'onGet',
		'post': 'onPost'
	};
	
	debug(h ? "has handler" : "could not load handler");
	
	var mount = (ext_path ? "/" + ext_path : '') + "/" + 
		(mpath == 'index' ? '' : mpath)
	;
	
	if (h) this.disp[rmeth[method]](mount, h);
	debug("ADDED %s %s => %s", method.toUpperCase(), mount, fn);
}

function isValidHandler(fn) {
	return fn.match(/\.(?:get|post)\.js$/);
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
			config[ck] = in_config[ck];
		}
	}
	
	return config;
}


module.exports = TinyHttpd;