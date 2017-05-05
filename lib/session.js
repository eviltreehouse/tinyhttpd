var crypto = require('crypto');
var cookie = require('cookie');
var debug = require('debug')('tinyhttpd:session');

const DEFAULT_CIPHER = 'aes192';
const CIPHERED_ENCODING = 'base64';

function TinyHttpdSession(sess_conf, cookie_val) {
	// sess_conf = { 'maxage: ' .., 'domain': .. };
	this.data = {};
	this.cipher = DEFAULT_CIPHER;
	
//	debug('conf %j', sess_conf);
	
	this.cookie_id = sess_conf.id;
	
	this.maxage = sess_conf.maxage;
	this.domain = sess_conf.domain;
	this.secret = sess_conf.secret;
	if (sess_conf.cipher) this.cipher = sess_conf.cipher;
	
	// initialize if we have data to use..
	if (cookie_val) {
		debug("Cookie header present.");
		var cookies = cookie.parse(cookie_val);
		if (cookies[this.cookie_id]) {
			debug("Cookie w/ matching ID present.");
			this.fromCookie(cookies[this.cookie_id]);	
		}
	} else {
		debug("No cookie provided - beginning blank session.");
	}
}

TinyHttpdSession.prototype.fromCookie = function(cv) {
	debug("Attempting to decrypt session.");
	var str_data = decrypt(this.cipher, this.secret, cv);
	if ((! str_data) || str_data.toString().trim().length == 0) {
		// no data or bad secret.
		debug("(No session data found in cookie)");
	} else {
		var o;
		try {
			o = JSON.parse(str_data);
		} catch(e) {
			// failed to properly parse
			debug("Could not parse session data.");
		}
		
		if (typeof o == 'object') {
			debug("Session decrypted successfully.");
			this.data = o;
		}
	}
};

TinyHttpdSession.prototype.setData = function(d) {
	debug("Setting session data to %j", d);
	
	for (var di in d) {
		this.data[di] = d[di];
	}
	
	return this;
};

TinyHttpdSession.prototype.toCookie = function() {
	if (Object.keys(this.data).length == 0) {
		// no data, don't bother.
		return null;
	}
	
	var enc = encrypt(this.cipher, this.secret, JSON.stringify(this.data));
	if (enc == null) {
		// failed to properly prepare the data
		debug("Could not create cookie -- setting as blank");
		enc = " ";
	}
	
	debug("Generating cookie header string");
	var hv = cookie.serialize(this.cookie_id, enc, {
		'maxAge': this.maxage,
		'domain': this.domain
	});

	return hv;
};

TinyHttpdSession.prototype.updateResponse = function(r) {
	var c = this.toCookie();
	debug("Adding cookie to response: %j", c);
//	r.setHeader('Set-Cookie', c);
	r.cookie(c, null);
};

function decrypt(cipher, secret, v) {
	var c;
	
	debug("Decrypting " + v);
	
	[cipher, DEFAULT_CIPHER].forEach((ciph_id) => {
		if (c) return;
		try {
			c = crypto.createDecipher(cipher, secret);
		} catch (e) {
			debug("Could not create a valid decipher (" + [cipher, DEFAULT_CIPHER].join(", ")  + "not available).");
		}		
	});

	if (! c) {
		debug("Giving up on decrypt")
		return null;
	} else {
		var dec = null;
		
		try {
			dec = c.update(v, CIPHERED_ENCODING, 'utf8');
			dec += c.final('utf8');
		} catch(e) {
			debug("FAILED to decrypt -- cipher / secret err.");
		}
		
		return dec;
	}	
}

function encrypt(cipher, secret, v) {
	var c;
	debug("Encrypting " + v);
	
	[cipher, DEFAULT_CIPHER].forEach((ciph_id) => {
		if (c) return;
		try {
			c = crypto.createCipher(cipher, secret);
		} catch (e) {
			debug("Could not create a valid cipher (" + [cipher, DEFAULT_CIPHER].join(", ")  + "not available).");
		}		
	});
	
	if (! c) {
		debug("Giving up on encrypt")
		return null;
	} else {
		var enc = c.update(v, 'utf8', CIPHERED_ENCODING);
		enc += c.final('base64');
		return enc;
	}
}

module.exports = TinyHttpdSession;