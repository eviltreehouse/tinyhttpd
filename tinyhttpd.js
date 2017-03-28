var fs = require('fs');
var path = require('path');
var lie = require('lie');
var debug = require('debug')('tinyhttpd:main');
var spawn = require('child_process').spawn;

var httpd = require('http');
var url = require('url');
var ejs = require('ejs');
var less = require('less');
var cookie = require('cookie');
var Session = require('./lib/session');

var HttpDispatcher = require('./lib/httpdispatcher-deferred');


function TinyHttpd(config) {
	this.config = parseConfig(config);
	this.sessionConfig = makeSessionConfig(this.config);
	
	this.disp   = new HttpDispatcher();
	this.http   = null;
	this.url = 'http://' + [this.config.interface, this.config.port].join(":");

	this.started = false;
	
	this.version = require('./package').version;
	this.provides = {};
	
	this._cache = { 'less':{},'view':{} };
	
	var self = this;
	
	var parseBaseDir = function() { 
		if (self.config.basedir == null && !fs.existsSync(self.config.basedir)) {
			debug("Basedir not defined or is not accessible. Skipping dynamic configuration.");
			return lie.resolve([]);	
		} else {
			return self.parseBaseDir('', false); 
		}
	};
	var setUp = function(app) { return self.setUp(app); };
	
	return parseBaseDir().then(setUp).catch((err) => { console.error('err!', err); });
}

TinyHttpd.prototype.provide = function(id, cb) {
	this.provides[id] = cb;
};

/** 
 * If you 'really' want to configure your own routing
 * you can do it this way (essentially just a wrapper 
 * for the dispatcher.)
 */
TinyHttpd.prototype.route = function(r, m, h) {
	var dispMap = {'get': 'onGet', 'post': 'onPost' };
	if (typeof r == 'object' && !m && !h) {
		// route table
		// [
		// 	[ method, route|regexp, handler ],
		//	 ...
		// ]
		for (var ri in r) {
			this.route.apply(this, r[ri]);
		}
	} else if (r && m && h) {
		// static
		if (! dispMap[m.toLowerCase()]) {
			debug(`Method ${m} not supported!`);
			return;	
		}
		
		debug(`+ ${m} ${r} ==>`);
		
		this.disp[dispMap[m.toLowerCase()]](r, h);
	}
};

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
	
	this.disp.onError(function(req, res) {
		res.writeHead(404);
		res.end('File Not Found');
	});
	
	this.setupPostFilter();
	
	return lie.resolve(this);
};

TinyHttpd.prototype.setupResponseFilter = function() {
	var self = this;
	
	this.disp.beforeFilter(/\//, function(req, res, chain) {
		self.augmentRequest(req);
		self.augmentResponse(res);
		
		chain.next(req, res, chain);
	});	
};

TinyHttpd.prototype.setupPostFilter = function() {
	this.disp.afterFilter(/\//, function(req, res, chain) {
		debug("In post filter " + (res.finished ? '[finished]' : '[not finished]') );
		if (! res.finished) {
			debug("Response was hung open -- closing.");
			res.end();
		}
		
		chain.next(req, res, chain);
	});
};

TinyHttpd.prototype.augmentRequest = function(req) {
	var self = this;
	
	self.my = {};

	// Set up our custom provisions
	for (var id in this.provides) {
		var v;
		if (typeof this.provides[id] == 'function') {
			v = this.provides[id](req);
		} else {
			v = this.provides[id];
		}
		
		self.my[id] = v;
	}
	
	// Set up sessions..
	if (this.config.sessions) {
		var s = {};
		
		debug('in headers %j', req.headers);
		
		var sess = new Session(this.sessionConfig, req.headers['cookie']);
		
		req.session = self.session = sess.data ? sess.data : s;
	} else {
		self.session = null;
	}
	
	// req.app.my.x or req.my.x
	req.my = self.my;
};

TinyHttpd.prototype.augmentResponse = function(res) {
	var self = this;
	
	// .app - reference to tinyhttpd instance
	res.app = self;
	
	// side-load some http.response prims around
	var _end = res.end;
	var _writeHead = res.writeHead;
	var _write = res.write;
	
	res._buf = "";
	res._status_code = null;
	res._headers = {};
	res._set_cookie = {};
	
	res.write = function(content, encoding) {
		// todo	-- support `encoding`?
		this._buf += content;
	};
	
	res.end = function(content) {
		if (content) this._buf += content;
		
		var arr_headers = [];
		
		for (var cid in this._set_cookie) {
			if (this._set_cookie[cid] == null)
				arr_headers.push(cid);
			else arr_headers.push(`${cid}=` + this._set_cookie[cid]);	
		}
		
		if (arr_headers.length) this._headers['Set-Cookie'] = arr_headers;
		
		//debug('end() http %s headers: %j, buffer: %s', this._status_code, this._headers, this._buf);
		
		_writeHead.apply(this, [this._status_code, this._headers]);
		
		// put back write() b/c end() uses it..
		res.write = _write;
		
		_end.apply(this, [this._buf]);
	};
	
	res.writeHead = function(status_code, headers) {
		this._status_code = status_code;
		if (headers) {
			for (var hi in headers) {
				this._headers[hi] = headers[hi];
			}
		}
	};
	
	res.cookie = function(id, cv) {
		this._set_cookie[id] = cv;	
	};
	
	// .render - EJS shorthand
	res.render = function(v, data) {
		var output = "";
		var view_file = path.join(self.config.basedir, v + ".ejs");
		var src;
		
		var succ = false;
		
		if (this.app.config.cache_views && this.app._cache[ view_file ]) {
			debug(`${v} is cached`);
			src = this.app._cache[ view_file ];	
		} else {
			if (fs.existsSync(view_file)) {
				src = fs.readFileSync(view_file).toString('utf8');
			} else {
				output = `[Cannot load view src: ${v}]`;
			}
			
			if (this.app.config.cache_views) {
				debug(`${v} is NOW cached`);
				this.app._cache[ view_file ] = src;
			}
		}
		
		if (src) {
			var view_data = mergeViewData(data, self.my);
			var opts = {
				// so includes will work..
				'filename': view_file
			};

			try {
				
				var render_scope = {};
				output = ejs.render.apply(render_scope, [ src, view_data, opts] );
				succ = true;
			} catch(e) {
				debug(e.message);
				output = `[render() ERROR: ${e.name}] ${e.message}`;
			}					
		}
		
		this.writeHead(succ ? 200 : 500, { 'Content-Type': 'text/html' });
		this.end(output);
	};
	
	// .err - non-200 response
	res.err = function(http_code, err_msg, c_type) {
		if (! c_type) c_type = 'text/plain';
		this.writeHead(http_code, { 'Content-Type': c_type });
		this.end(err_msg ? err_msg : '');
	};
	
	// .deliver - send 200, ctype, .end(content)
	res.deliver = function(c_type, content) {
		this.writeHead(200, { 'Content-Type': c_type });
		this.end(content);
	};
	
	// .define - request-specific 'provide'
	res.define = function(k, v) {
		self.my[k] = v;	
	};
	
	// .redirect - send 301
	res.redirect = function(to) {
		res.writeHead(301, { 'Location': to });
		res.end();
    };

	// .session - update session cookie
	if (this.config.sessions) {
		res.session = function(k, v) {
			self.session[k] = v;
			
			var s = new Session(self.sessionConfig, "");
			s.setData(self.session);
			s.updateResponse(res);
		};
	}
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
			debug(`httpd service listening on ${this.config.interface}:${this.config.port}`);
			this.started = true;
			resolve(scope);			
		} else {
			debug("Failed to create httpd server!");
			reject('createServer failed');
		}
	});
};

TinyHttpd.prototype.stop = function() {
	return new lie((resolve) => {
		debug("Stopping httpd service");
		try {
			this.http.close(() => {
				debug("httpd Stopped.");
				this.disp = this.http = null;
				this.started = false;
				resolve(true);
			}, (err) => {
				debug("!?!?!");
				reject(err);
			});
		} catch(e) {
			console.error('!!!');
			reject(e.message);
		}
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
	
	if (th.config.cache_less && th._cache.less[less_file]) {
		return lie.resolve(th._cache.less[less_file] + "\n/* (resolved from cache) */\n");	
	}
	
	var opts = {
		'filename': less_file,
//		'sourceMapRootPath': path.dirname(less_file) + "/"
	};
	
	debug("lessRender() %j", opts);
	
	return new lie((resolve) => {
		less.render(fs.readFileSync(less_file).toString('utf8'), opts).then((output) => {
			if (th.config.cache_less) th._cache.less[less_file] = output.css;
			
			resolve(output.css);
		}, (err) => {
			debug("LESS render error: " + err);
			resolve('');
		});
	});
}

function mergeViewData(definite, passive) {
	var data = {};
	for (var vk in passive) {
		data[vk] = passive[vk];
	}
	
	for (var vk in definite) {
		if (typeof data[vk] !== 'undefined') {
			// resolve the conflict before overwrite
			data['my_' + vk] = data[vk];
		}
		
		data[vk] = definite[vk];
	}

	return data;
};

function defaultConfig() {
	return {
		'interface': '127.0.0.1',
		'port': process.env.PORT ? process.env.PORT : 4101,
		'basedir': path.join(process.cwd(), 'app'),
		'cache_less': false,
		'cache_views': false,
		
		'sessions': false,
		'sessions.secret': null,
		'sessions.maxage': null,
		'sessions.domain': null,
		'sessions.cipher': null
	};
}

function parseConfig(in_config) {
	var config = defaultConfig();
	
	if (in_config) {
		for (var ck in in_config) {
			config[ck] = in_config[ck];
		}
	}
	
//	debug("in config: %j", in_config);
//	debug("ready config: %j", config);

	// validate some conflicting settings...
	if (config['sessions'] && !config['sessions.secret']) {
		console.error("[!] Cannot enable sessions w/o secret defined!");
		config['sessions'] = false;
	}
	
	return config;
}

function makeSessionConfig(cfg) {
	return {
		'id': 'S',
		'maxage': cfg['sessions.maxage'],
		'domain': cfg['sessions.domain'],
		'secret': cfg['sessions.secret']
	};
}


module.exports = TinyHttpd;