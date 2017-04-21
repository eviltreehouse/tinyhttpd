module.exports = (req, res) => {
	// Use mdsrc.ejs to build our Markdown src
	res.renderMd({'from': './mdsrc', 'data': { 't': "The Title" }});
};