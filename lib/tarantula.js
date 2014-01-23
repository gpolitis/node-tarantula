'use strict';
var request = require('request');
var cheerio = require('cheerio');
var events = require('events');
var async = require('async');
var url = require('url');
var _ = require('lodash');

var Tarantula = function (brain) {
	// extend defaults
	this.brain = {};
	for (var i in Tarantula.DefaultBrain) {
		this.brain[i] = (brain && typeof brain[i] !== 'undefined') ? brain[i] : Tarantula.DefaultBrain[i];
	}
};
Tarantula.DefaultBrain = {
	// {int} Max number of connections
	legs: 10,
	// {bool} If we should remove '#' Anchors from links
	trimHashes: true,
	// {bool} If we should skip Duplicate URI's we see
	skipDupes: true,
	// {bool} If we should stay on the base url path
	stayInRange: false,
	// {string} User agent to use in requests
	userAgent: 'Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0',
	// {function} How to gather links from a page
	visit: function (uri, request, response, body, $) {
		var uris = _.filter($('a').toArray().map(function (elem) {
			if (elem.attribs && typeof elem.attribs.href === 'string') {
				return url.resolve(uri, elem.attribs.href);
			}
		}));
		return uris;
	},
	// {function} Determine if Tarantula should visit this uri
	shouldVisit: function (uri) {
		if (uri) {
			return true;
		}
	},
	// {function} Use this function to modify any Headers you need
	// @see npm request
	modRequest: function (req) {
		return req;
	},
};
Tarantula.prototype = new events.EventEmitter();
Tarantula.prototype.start = function (frontier) {
	if (typeof frontier === 'string') {
		frontier = [frontier];
	}
	if (!_.isArray(frontier)) {
		throw new TypeError('Tarantula::start requires Array of URLs to crawl');
	}
	var tarantula = this;
	var brain = this.brain;
	var range = new RegExpSet(frontier);
	var uriQ = frontier.slice(0);
	var taskQ = async.queue(function (uri, checkIn) {
		var req = brain.modRequest({
			uri: uri,
			headers: {
				'User-Agent': brain.userAgent
			}
		});

		tarantula.emit('request', uri, req);
		request(req, receive);

		function receive (err, resp, body) {
			if (!err && resp.statusCode == 200) {
				tarantula.emit('visit', uri, req, resp);
				var $ = cheerio.load(body);
				// TODO error handling.
				var uris = brain.visit(uri, req, resp, body, $);
				if (!_.isArray(uris)) {
					throw new TypeError('brain::visit did not yield an array');
				}
				if (brain.trimHashes) {
					uris = uris.map(trimHash);
				}
				if (brain.skipDupes) {
					uris = _.difference(_.unique(uris), uriQ);
				}
				if (brain.stayInRange) {
					uris = uris.filter(range.test);
				}
				if (brain.shouldVisit) {
					uris = uris.filter(brain.shouldVisit);
				}
				if (uris.length) {
					uriQ.push.apply(uriQ, uris);
					taskQ.push(uris);
				}
				tarantula.emit('uris', uris.length, uriQ.length, uri, req, resp);
			}
			else {
				var errorCode = resp && resp.statusCode;
				tarantula.emit('error', errorCode, uri, req, resp);
			}
			checkIn();
		}
	}, brain.legs);
	taskQ.drain = function () {
		tarantula.emit('done');
	};
	taskQ.push(uriQ);
};
function RegExpSet (arr) {
	for (var i = 0; i < arr.length; i++) {
		this.push(new RegExp(arr[i]));
	}
	this.test = this.test.bind(this);
}
RegExpSet.prototype = [];
RegExpSet.prototype.test = function (str) {
	for (var i = 0; i < this.length; i++) {
		if (this[i].test(str)) {
			return true;
		}
	}
	return false;
};

/**
 * Remove Hash part of a URL
 *
 * @param {string} uri
 *   The URL to remove hash from
 * @param {string}
 *   The URL without hash
 */
function trimHash (uri) {
	var indexOfHash = uri.indexOf('#');
	return (indexOfHash != -1) ? uri.substring(0, indexOfHash) : uri;
}

module.exports = Tarantula;