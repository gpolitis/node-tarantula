#!/usr/bin/env node
/*global require*/
var Tarantula = require('./lib/tarantula.js');

var site = 'http://en.wikipedia.org/';
var tarantula = new Tarantula({
	legs: 10,
	stayInRange: true,
	modRequest: function (req) {
		req.headers.userAgent = 'Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0';
		return req;
	}
});
console.log('Crawling… ', site);
tarantula.on('request', function (uri) {
	console.log('GET', uri);
});
tarantula.on('visit', function (uri) {
	console.info('200', uri);
});
tarantula.on('uris', function (newCount, newTotal) {
	console.log(newTotal + ' (+' + newCount +')');
});
tarantula.on('error', function (errorCode, uri, req, resp) {
	console.error(errorCode || 'ERR', uri, req, resp);
});
tarantula.on('done', function () {
	console.info('done');
});

tarantula.start([site]);
