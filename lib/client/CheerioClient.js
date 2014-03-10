var request = require('request');
var cheerio = require('cheerio');

function CheerioClient (options) {
	options = options || {};
	this.requestSettings = {};
	this.headers = {};
	this.getData = function () {};
	this.listener = function () {};
	this.receive = this.receive.bind(this);
}
/**
 * Sets an HTTP Proxy
 *
 * @param {string} domain
 *   An http proxy domain
 *   Unsets the proxy if an empty string is provided
 * @param {string} port (optional)
 *   Applies a port number if specified
 * @param {string} username (optional)
 * @param {string} password (optional)
 * @return this - for chaining
 */
CheerioClient.prototype.setProxy = function (domain, port, username, password) {
	if (domain) {
		var uri = 'http://';
		if (username) {
			uri += username;
			uri += password ? ':' + password : '';
			uri += '@';
		}
		uri += domain;
		uri += (port ? ':' + port : '');
	} else {
		delete this.requestSettings.proxy;
	}
	return this;
};
/**
 * Sets if we should check SSL certs are valid
 *
 * @param
 */
CheerioClient.prototype.setStrictSSL = function (strictSSL) {
	this.requestSettings.strictSSL = !!strictSSL;
	return this;
};
/**
 * Sets HTTP Headers
 *
 * @param {object} headers
 *   HTTP Headers provided with header names as object keys
 * @return this - for chaining
 */
CheerioClient.prototype.setHeaders = function (headers) {
	this.headers = headers;
	return this;
};
/**
 * Sets HTTP Headers
 *
 * @param {string} name - HTTP Header Name
 * @param {string} value - HTTP Header Value
 * @return this - for chaining
 */
CheerioClient.prototype.setHeader = function (name, value) {
	this.headers[name] = value;
	return this;
};
/**
 * Sets Request options
 *
 * @see https://github.com/mikeal/request#requestoptions-callback
 * @param {string} name - Request Option Name
 * @param {string} value - Request Option Value
 * @return this - for chaining
 */
CheerioClient.prototype.setClient = function (name, value) {
	this.requestSettings[name] = value;
	return this;
};
/**
 * Sets a listening function for all events
 * Note: unlike traditional listeners, this may only have one listener function
 *
 * @param {function} listener
 *   Called when an event is fired
 * @return this - for chaining
 */
CheerioClient.prototype.setListener = function (listener) {
	this.emit = listener;
	return this;
};
/**
 * Placeholder event listener
 * Just in case a listener is not set
 *
 * @param {string} eventName - name of the event to fire
 * @param {…string|object} data - arguments from event
 * @return this - for chaining
 */
CheerioClient.prototype.emit = function (eventName) {
	console.log(eventName, arguments);
};
/**
 * Retreive a web page
 *
 * @param {string} uri
 *   The URI to request
 * @param {function} getData
 *   Called called once the uri has been reached
 *   Will be passed Cheerio loaded with page content, and the page
 */
CheerioClient.prototype.get = function (uri, getData) {
	this.uri = uri || this.uri;
	this.getData = getData || this.getData;
	this.requestParams = {
		uri: this.uri,
		headers: this.headers,
	};
	for (var key in this.requestSettings) {
		this.requestParams[key] = this.requestSettings[key];
	}
	this.emit('request');
	this.request = request(this.requestParams, this.receive);
};
/**
 * Receive a web page (from request module)
 *
 * @param {object} error
 *   Error object from request
 * @param {object} response
 *   Response object from request
 * @param {object} body
 *   Web page Body object from request
 */
CheerioClient.prototype.receive = function (error, response, body) {
	this.response = response;
	// Some request error. Complain to the listener
	if (error) {
		this.emit('error', 'ERR', error);
	}
	// No actual data from request?  Complain to the listener
	else if (!response) {
		this.emit('error', 'ERR', 'No Response');
	}
	// Invalid page? Complain to the listener
	else if (response.statusCode !== 200) {
		this.emit('error', response.statusCode, 'Http Status');
	}
	// Valid response!
	// Let Node keep going before CPU-intense operation
	else {
		setImmediate(this.loadPage.bind(this, response, body));
	}
};
/**
 * Process a valid http response
 *
 * @param {object} response
 *   Response object from request
 * @param {object} body
 *   Web page Body object from request
 */
CheerioClient.prototype.loadPage = function (response, body) {
	if (!isHtml(response.headers['content-type'])) {
		this.emit('error', 'ERR', 'Not HTML: ' + response.headers['content-type']);
		return;
	}
	try {
		this.$ = cheerio.load(body);
	} catch (e) {
		this.emit('error', 'ERR', 'Cheerio failed to parse');
		return;
	}
	try {
		this.data = this.getData(this.$, this.request.uri.href);
	}
	catch (e) {
		this.emit('data', []);
		return;
	}
	var THIS = this;
	setImmediate(function () {
		THIS.emit('data', THIS.data, THIS.request.uri.href);
	});
};
/**
 * Destroy the request object
 *   This is required for a common interface
 */
CheerioClient.prototype.destroy = function () {
	if (this.request) {
		this.request = null;
	}
};

/**
 * Determine if the based in string is HTML
 *
 * @param {string} mimeType
 *   The Mime Type to check
 * @return {boolean}
 *   True if the mime type is html
 */
var isHtml = /text\/html/;
isHtml = isHtml.test.bind(isHtml);

module.exports = CheerioClient;
