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
CheerioClient.prototype.setProxy = function (proxy) {
	if (proxy) {
		this.requestSettings.proxy = 'http://' + proxy;
	} else {
		delete this.requestSettings;
	}
	return this;
};
CheerioClient.prototype.setHeaders = function (headers) {
	this.headers = headers;
	return this;
};
CheerioClient.prototype.setHeader = function (name, val) {
	this.headers[name] = val;
	return this;
};
CheerioClient.prototype.setClient = function (name, val) {
	this.requestSettings[name] = val;
	return this;
};
// Light-weight Listeners
CheerioClient.prototype.setListener = function (fn) {
	this.emit = fn;
	return this;
};
CheerioClient.prototype.emit = function () {
};
CheerioClient.prototype.get = function (uri, getData) {
	this.uri = uri || this.uri;
	this.getData = getData || this.getData;
	this.request = {
		uri: this.uri,
		headers: this.headers,
	};
	for (var key in this.requestSettings) {
		this.request[key] = this.requestSettings[key];
	}
	this.emit('request');
	request(this.request, this.receive);
};
CheerioClient.prototype.receive = function (error, response, body) {
	this.response = response;
	if (error) {
		this.emit('error', 'ERR', error);
	}
	else if (!response) {
		this.emit('error', 'ERR', 'No Response');
	}
	else if (response.statusCode !== 200) {
		this.emit('error', response.statusCode, 'Http Status');
	}
	else {
		// TODO cheerio error handling.
		var THIS = this;
		setImmediate(function () {
			if (!isHtml(response.headers['content-type'])) {
				THIS.emit('error', 'ERR', 'Not HTML');
				return;
			}
			try {
				THIS.$ = cheerio.load(body);
			} catch (e) {
				THIS.emit('error', 'ERR', 'Cheerio failed to parse');
				return;
			}
			try {
				THIS.data = THIS.getData(THIS.$, THIS.uri);
			}
			catch (e) {
				THIS.emit('data', []);
				return;
			}
			setImmediate(function () {
				THIS.emit('data', THIS.data);
			});
		});
	}
};
CheerioClient.prototype.destroy = function () {
};


var isHtml = /text\/html/;
isHtml = isHtml.test.bind(isHtml);

module.exports = CheerioClient;
