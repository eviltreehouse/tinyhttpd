module.exports = (req, res) => {
		var sv = "";
		if (req.session && req.session.v == "Hello") sv = "session value set";

		var html = `<html><body>sessions OK<br />${sv}</body></html>`;
		res.deliver('text/html', html);
};