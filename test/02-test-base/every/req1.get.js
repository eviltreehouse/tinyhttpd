module.exports = function(req, res) {
	res.deliver('text/plain', 'gv is ' +( req.my.gv ? req.my.gv : '???'));
};