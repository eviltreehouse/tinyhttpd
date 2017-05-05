module.exports = function(req, res) {
	callANonExistantFunction();
	res.deliver('text/html', "123456");
}