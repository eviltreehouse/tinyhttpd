var HttpDispatcher = require('httpdispatcher');
var http           = require('http');
var dispatcher     = new HttpDispatcher();

var ejs = require('ejs');

dispatcher.setStatic('/resources');
dispatcher.setStaticDirname('static');

dispatcher.onGet("/page1", function(req, res) {
	res.writeHead(200, {'Content-Type': 'text/plain'});
	res.end('Page One');
});

dispatcher.onGet(/\/anything\//, function(req, res) {
	res.writeHead(200, {'Content-Type': 'text/html'});
	res.end("We got here from the anything route: " + req.url);
});

dispatcher.onPost("/page2", function(req, res) {
	res.writeHead(200, {'Content-Type': 'text/plain'});
	res.end(req.body);
});

dispatcher.onGet("/args", function(req, res) {
	res.setHeader('X-Foobar', '123');
	res.writeHead(200, {'Content-Type': 'text/html'});
	res.end(req.params);
});

dispatcher.onPost("/args", function(req, res) {
	res.writeHead(200, {'Content-Type': 'text/html'});

	var json;
	console.log(req.headers["content-type"]);

	if (req.headers["content-type"] == 'application/json' && Object.keys(req.params)[0].match(/^\{/)) {
		console.log("Its JSON");
		try {
			json = JSON.parse( Object.keys(req.params)[0] );
		} catch(e) {
		}
		
		console.log(json);
	}

	res.end(json ? json.test : "null");
});

dispatcher.onGet("/ejs", function(req, res) {
	var view = "<html><body><p>The value of foobar is <%= foobar %>.</p></body></html>";

	var output = '';
	try {
		output = ejs.render(view, req.params);
	} catch(e) {
		output = `[ Error rendering view: ${e.message} ]`;
	}

	res.writeHead(200, {'Content-Type': 'text/html'});
	res.end( output );
});

dispatcher.beforeFilter(/\//, function(req, res, chain) { //any url
	console.log("Before filter");
	chain.next(req, res, chain);
});

dispatcher.afterFilter(/\//, function(req, res, chain) { //any url
	console.log("After filter");
	chain.next(req, res, chain);
});

dispatcher.onError(function(req, res) {
	res.writeHead(404);
	res.end('File Not Found');
});

http.createServer(function (req, res) {
	dispatcher.dispatch(req, res);
	}).listen(1337, '127.0.0.1');


//launchClient();
//
//function launchClient() {
//	var spawn = require('child_process').spawn;
//	var browser = spawn('open', [ 'http://127.0.0.1:1337' ]);
//}
