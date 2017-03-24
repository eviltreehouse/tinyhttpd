module.exports = function(req, res) {
	res.deliver('text/plain', "In subdir");
};