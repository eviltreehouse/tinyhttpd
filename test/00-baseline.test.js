var assert = require('simple-assert');

describe("TinyHttpd baseline tests", () => {
	it("Should require() properly", () => {
		var th = require('../tinyhttpd');
		assert(typeof th == 'function');
	});
});