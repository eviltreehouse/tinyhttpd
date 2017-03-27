module.exports = (req, res) => {
	res.session('v', "Hello");
	res.deliver('text/plain', 'session value set OK I hope.');
};