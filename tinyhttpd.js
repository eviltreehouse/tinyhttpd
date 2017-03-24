var fs = require('fs');
var path = require('path');
var lie = require('lie');
var debug = require('debug')('tinyhttpd:main');
var spawn = require('child_process').spawn;

var httpd = require('http');
var url = require('url');
var ejs = require('ejs');
var less = require('less');

var HttpDispatcher = require('httpdispatcher');


function TinyHttpd(config) {
	this.config = parseConfig(config);
	this.disp   = new HttpDispatcher();
	this.http   = null;
	this.url = 'http://' + [this.config.interface, this.config.port].join(":");

	this.version = require('./package').version;
	
	var self = this;
	
	var parseBaseDir = function() { return self.parseBaseDir('', false); };
	var setUp = function(app) { return self.setUp(app); };
	
	return parseBaseDir().then(setUp).catch((err) => { console.error('err!', err); });
}

TinyHttpd.prototype.parseBaseDir = function(root, sub_dir) {
	var self = this;
	
	var loaded = [];
	
		var fpath = path.join(this.config.basedir, root);
//		debug("fpath => %s", fpath);
		
		var files = fs.readdirSync(fpath);
		
		files.forEach(function(v) {
			debug("%s/%s", root, v);
			var st = fs.statSync(fpath + "/" + v);
			if (st.isFile() && isValidHandler(v)) {
				loaded.push([ 'h', root, v ]);
			} else if (st.isFile() && isLess(v)) {
				loaded.push([ 'l', root, v ]);
			} else if (st.isDirectory()) {
//				debug("Traversing.. %s", v);
				var hs = self.parseBaseDir(path.join(root, v), true);
				loaded = loaded.concat(hs);
			}
		});
		
		return sub_dir ? loaded : lie.resolve(loaded);
//	return lie.resolve({});
};

TinyHttpd.prototype.setUp = function(cnf) {
	this.setupResponseFilter();
	
	for (var hi in cnf) {
		//debug(cnf[hi]);
		var def = cnf[hi];
		if (def[0] == 'h') this.register(def[1], def[2]);
		else if (def[0] == 'l') this.registerLess(def[1], def[2]);
	}
	
	return lie.resolve(this);
};

TinyHttpd.prototype.setupResponseFilter = function() {
	var self = this;
	
	this.disp.beforeFilter(/\//, function(req, res, chain) {
		self.augmentResponse(res);
		
		chain.next(req, res, chain);
	})
};

TinyHttpd.prototype.augmentResponse = function(res) {
	var self = this;
	
	// .app - reference to tinyhttpd instance
	res.app = self;
	
	// .render - EJS shorthand
	res.render = function(v, data) {
		var output = "";
		try {
			var view_file = path.join(self.config.basedir, v + ".ejs");
			if (fs.existsSync(view_file)) {
				var src = fs.readFileSync(view_file).toString('utf8');
				output = ejs.render(src, data);
			} else {
				output = `[Cannot load view src: ${v}]`;
			}
		} catch(e) {
			debug(e.message);
			output = `[render() ERROR: ${e.name}]`;
		}
		
		res.writeHead(200, { 'Content-Type': 'text/html' });
		res.end(output);
	};
	
	// .err - non-200 response
	res.err = function(http_code, err_msg, c_type) {
		if (! c_type) c_type = 'text/plain';
		res.writeHead(http_code, { 'Content-Type': c_type });
		res.end(err_msg ? err_msg : '');
	};
	
	// .deliver - send 200, ctype, .end(content)
	res.deliver = function(c_type, content) {
		res.writeHead(200, { 'Content-Type': c_type});
		res.end(content);
	};
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

TinyHttpd.prototype.stop = function() {
	return new lie((resolve) => {
		debug("Stopping httpd service");
		this.http.close(() => {
			debug("httpd Stopped.");
			this.disp = this.http = null;
			
			resolve(true);
		});
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
//	debug("register => %s %s", ext_path, fn);
	
	hf = fn.replace(/\.js$/, '');
	def = /^(.*?)(-x)?\.(.*?)$/.exec(hf);
	var mpath = def[1];
	var dashx = def[2] ? true : false;
	
	var method = def[3];
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
	
	var mounts = [];

	if (dashx) {
		// entity handler: /h/xyz
		mounts.push(
			new RegExp("^" + 
				(ext_path ? "/" + ext_path : '') + "/" +
				(mpath == 'index' ? '' : mpath) +
				"/.+$"
			)
		);
	} else {
		// standard exact-match handler
		mounts.push((ext_path ? "/" + ext_path : '') + "/" + 
			(mpath == 'index' ? '' : mpath)
		);

		if (mpath == 'index' && ext_path.length > 0) {
			// let index response to /dir as well as /dir/
			mounts.push("/" + ext_path);
		}
	}
	
	if (h) {
		if (dashx) {
			// dig out our ID value
			var hndl = h;
			h = function(req, res) {
				var url_path = url.parse(req.url).pathname;
				var mnt = mounts[0].toString();
				
				mnt = mnt.replace(/\^/, '').replace(/^\//, '')
					.replace(/\/$/, '').replace(".+$", '').replace(/\\\//g, "/")
				;				
				var id = url_path.replace(mnt, '');

				if (id.match(/\//)) {
					// multiple elements
					id = id.split(/\//);
				}
				
				return hndl(req, res, id);
			};
		}
		for (var mi in mounts) {
			var mount = mounts[mi];
			
			this.disp[rmeth[method]](mount, h);
			debug("ADDED %s %s => %s", method.toUpperCase(), typeof mount == 'string' ? mount : mount.toString(), fn);
//			if (dashx) debug("DASH-X => TRUE");
		}
	}
}

TinyHttpd.prototype.registerLess = function(ext_path, fn) {
	// @TODO -- set up a handler that, when requesting /subdir/stylesheet.css, will
	// render and return /subdir/stylesheet.less.
//	debug("registerLess() not implemented");
//	return;
	hf = fn.replace(/\.less$/, '');
	
	var hp = path.join(this.config.basedir, ext_path, fn);
	
	var mount = (ext_path.length > 0 ? '/' : '') + `${ext_path}/${hf}.css`;
	
	this.disp.onGet(mount, (req, res) => {
		lessRender(this, hp).then((output) => {
			if (output) {
				res.deliver('text/css', output);
//				res.writeHead('200', {'Content-Type': 'text/css'});
//				res.end(output);
			} else {
				res.err(404, 'No CSS output?');
			}
		});
	});
	
	debug("ADDED %s %s =render=> %s", 'GET', mount, hf + ".less");
};

function isValidHandler(fn) {
	return fn.match(/\.(?:get|post)\.js$/);
}

function isLess(fn) {
	return fn.match(/\.less$/);
}

function lessRender(th, less_file) {
	
	var opts = {
		'filename': less_file,
//		'sourceMapRootPath': path.dirname(less_file) + "/"
	};
	
	debug("lessRender() %j", opts);
	
	return new lie((resolve) => {
		less.render(fs.readFileSync(less_file).toString('utf8'), opts).then((output) => {
			resolve(output.css);
		}, (err) => {
			debug("LESS render error: " + err);
			resolve('');
		});
	});
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