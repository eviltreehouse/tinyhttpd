module.exports = (req, res) => {
	var qs = require('url').parse(req.url, true).query;
	
//	console.log(require('url').parse(req.url, true).query);
	res.define('v', qs.tv);
	res.render('test-define');
};