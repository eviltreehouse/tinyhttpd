module.exports = function(req, res) {
	res.deliver('text/plain', `qv is ${req.query.qv}`);
};