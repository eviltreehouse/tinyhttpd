module.exports = function(req, res) {
	req.my.gv = 123;
	
	return req.CONTINUE;
};