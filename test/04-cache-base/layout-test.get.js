module.exports = function(req, res) {
	res.define('layout', 'layout');
	res.define('gv', 123);
	res.render('cache-test');
};