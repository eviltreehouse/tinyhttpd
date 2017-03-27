var lie = require('lie');
var request = require('request');
var debug = require('debug')('tinyhttpd:util');

const INTERFACE = '127.0.0.1';
const BIND_PORT = '19891';

function get(uri, qs, h) {
	var url = `http://${INTERFACE}:${BIND_PORT}${uri}`;
	
	if (! h) h = {};
	
	return new lie((resolve, reject) => {
		request.get(url, { qs: qs, headers: h }, (err, response, body) => {
			if (err) {
				reject(err);
			} else {
//				debug('headers %j', response.headers);
				
				resolve({ 'code': response.statusCode, 'body': body, 'headers': response.headers });
			}
		});
	});
}

module.exports.get = get;