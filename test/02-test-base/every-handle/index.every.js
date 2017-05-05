module.exports = function(req, res) {
	res.deliver('text/plain', 'its handled.');
	
	return req.HANDLED;
};