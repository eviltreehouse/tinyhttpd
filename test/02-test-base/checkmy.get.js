module.exports = function(req, res) {
	res.deliver('text/plain', `My secret is ${req.my.secret}.`);
};