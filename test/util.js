var lie = require('lie');
var request = require('request');

const INTERFACE = '127.0.0.1';
const BIND_PORT = '19891';

function get(uri, qs) {
	var url = `http://${INTERFACE}:${BIND_PORT}${uri}`;
	
	return new lie((resolve, reject) => {
		request.get(url, { qs: qs }, (err, response, body) => {
			if (err) {
				reject(err);
			} else {
				resolve({ 'code': response.statusCode, 'body': body, 'res': response });
			}
		});
	});
}

module.exports.get = get;