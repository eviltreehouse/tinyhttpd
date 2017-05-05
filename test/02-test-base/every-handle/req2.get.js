module.exports = function(req, res) {
	res.deliver('text/plain', 'shouldnt be here');
};