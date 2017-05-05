module.exports = (req, res) => {
	res.session('v', "Hello");
	res.session('longer-value', "lorem4110 lorem4110 lorem4110 lorem4110 lorem4110 lorem4110 lorem4110 lorem4110 ");
	res.deliver('text/plain', 'session value set OK I hope.');
};