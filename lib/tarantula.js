var events = require('events');
var _ = require('lodash');
var RangeURL = require('./RangeURL.js');
var UserAgents = require('./UserAgents.json');
var ResourcePool = require('./ResourcePool.js');
var PhantomClient = require('./client/PhantomClient.js');
var CheerioClient = require('./client/CheerioClient.js');

// Brain is all of the settings you may want to override

var DefaultBrain = {
	// {int} Max number of connections
	legs: 10,
	// {int} Max number of requests to process on one connection
	//   before retiring the connection, and opening a fresh one
	legAge: 10,
	// {bool} If we should remove '#' Anchors from links
	trimHashes: true,
	// {bool} If we should skip Duplicate URI's we see
	skipDupes: true,
	// {bool} If we should stay on the base uri path
	stayInRange: false,
	// {string} User agent to use in requests
	//          We have several presets in UserAgents.json
	userAgent: 'Google Chrome 32 (Mac)',
	// {object} any other headers you might need
	headers: {},
	// {string} You may specify 'PhantomJS' or 'Cheerio'
	leg: 'Cheerio',
	// {string} If you need a proxy, specify domain and port "127.0.0.1:8080"
	// Sorry, no auth support yet
	proxy: '',
	// TODO: http proxy-auth supported by Request and PhatonmJS
	// TODO: PhatomJS ignore-ssl-errors + Request strictSSL
};
function Tarantula (brain) {
	this.brain = _.merge({}, DefaultBrain, brain);
	this.uris = [];
	this.visited = 0;
	this.range = new RangeURL();
	this.legs = new ResourcePool({
		max: this.brain.legs,
		maxUses: this.brain.legAge,
		create: this.growLeg.bind(this),
		destroy: this.shedLeg.bind(this),
		task: this.follow.bind(this),
		complete: this.complete.bind(this),
	});
	if (this.brain.userAgent) {
		this.brain.headers['User-Agent'] = UserAgents[this.brain.userAgent] || this.brain.userAgent;
	}
	
	this.on('data', function (task, uris) {
		this.push(uris, task);
	});
}
Tarantula.prototype = new events.EventEmitter();

// Public Functions
// You probably Do want to override as an implementor

/**
 * How to Scrape the given page
 *
 * In Parse mode
 *   You may not access "client-side" vars (document, window)
 *   You may access server globals.
 *
 * In PhantomJS mode
 *   You may access "client-side" vars (document, window)
 *   You may not access server globals.
 *
 * @param {jQuery} $ - A jQuery-like interface scoped to page
 * @param {string} pageUri - The URL we are visiting
 * @return {string[]} - A list of urls to crawl
 */
Tarantula.prototype.visit = function ($, pageUri) {
	var elements = $('a').toArray();
	var uris = new Array(elements.length);
	// return elements.length;
	var element;
	var uri;
	// return 'i hate you';
	for (var i = 0; i < elements.length; i++) {
		element = elements[i];
		uri = $(element).attr('href');
		uris[i] = resolve(uri);
	}
	return uris;
	// Get a Full URL from a link HREF
	function resolve (uri) {
		var loc = getLocation();
		if (!uri || typeof uri !== 'string') {
			return '';
		}
		if (uri.indexOf('javascript:') === 0 || uri.indexOf('mailto:') === 0) {
			return '';
		}
		if (uri.indexOf('http') === 0) {
			return uri;
		}
		if (uri.indexOf('//') === 0) {
			return loc.protocol + uri;
		}
		if (uri.indexOf('/') === 0) {
			return loc.host + uri;
		}
		if (loc.pathname.lastIndexOf('/') === loc.pathname.length) {
			return loc.host + loc.pathname + uri;
		}
		return loc.host + loc.pathname + '/' + uri;
	}
	// Get a Location object from the pageUri
	function getLocation () {
		if (!getLocation.loc) {
			var index;
			var loc = {};
			loc.href = pageUri;
			loc.protocol = loc.href.match(/[a-z]+:/);
			loc.protocol = loc.protocol ? loc.protocol[0] : '';
			loc.host = loc.href.match(/[a-z]+:\/\/[^\/]+/);
			loc.host = loc.host ? loc.host[0] : '';
			loc.pathname = loc.href.substr(loc.host.length - 1);
			loc.hash = '';
			loc.search = '';
			index = loc.pathname.indexOf('#');
			if (index >= 0) {
				loc.pathname = pageUri.substr(0, index);
				loc.hash = pageUri.substr(index);
			}
			index = loc.pathname.indexOf('?');
			if (index >= 0) {
				loc.pathname = pageUri.substr(0, index);
				loc.search = pageUri.substr(index);
			}
			getLocation.loc = loc;
		}
		return getLocation.loc;
	}
};
/**
 * Determine if Tarantula should visit this uri
 *
 * @public
 * @param {string} pageUri
 *   The URL we are considering visiting
 * @return {bool}
 *   True, if Tarantula should visit the URI
 */
Tarantula.prototype.shouldVisit = function (pageUri) {
	if (pageUri) {
		return true;
	}
};

// Private Functions
// You probably don't want to override as an implementor

/**
 * Tell the Tarantula to crawl the site
 *
 * @param {string[]} frontier
 *   Optional list of URI's to enqueue
 */
Tarantula.prototype.start = function (frontier) {
	this.push(frontier);
};
/**
 * Add more URIs for our crawler to visit
 *
 * @param {string|string[]} uris
 *   A list of URI's we intend to visit later
 * @param {object} parentTask
 * @param {string} parentTask.uri
 *   (optional) The URI where these were found
 *   If this is not passed, then we assume these are baes URI's
 * @param {string} parentTask.parent
 *   (optional) The URI where parentTask.uri was found
 * @emits "uris": with {string[]} uris, {string} parent
 *   If new URI's are enqueued
 * @return {string[]}
 *   New URI's that were pushed to the stack
 */
Tarantula.prototype.push = function (uris, parentTask) {
	// 1. Filter any empty URL's (happens)
	uris = _.filter(uris);
	// 2. Optionally, remove any anchor tags
	//    ex: http://example.com/#anchor
	if (this.brain.trimHashes) {
		uris = uris.map(trimHash);
	}
	// 3. Optionally, skip duplicate URL's
	//    otherwise, we'll likely get stuck in a loop
	if (this.brain.skipDupes) {
		uris = _.difference(_.unique(uris), this.uris);
	}
	// 4. Optionally, stay in range of the base (range) URL's
	//    Don't go to google.com, if we're on example.com
	if (this.brain.stayInRange && parentTask) {
		uris = uris.filter(this.range.test);
	}
	// 5. Optional, custom logic from the implementor
	if (this.shouldVisit) {
		uris = uris.filter(this.shouldVisit);
	}
	// Finally, If we've got new URI's, then queue them up
	if (uris.length) {
		var tasks = uris.map(function (uri) {
			return {
				uri: uri,
				parent: parentTask && parentTask.uri
			};
		});
		this.uris.push.apply(this.uris, uris);
		this.legs.enqueue(tasks);
		if (!parentTask) {
			this.range.push.apply(this.range, uris);
		}
		else {
			this.emit('uris', parentTask, uris.length);
		}
	}
	return uris;
};
/**
 * Tells the Tarantula to how to make a new leg
 */
Tarantula.prototype.growLeg = function () {
	if (this.brain.leg === 'PhantomJS') {
		return new PhantomClient();
	}
	else {
		return new CheerioClient();
	}
};
/**
 * Tells the Tarantula to how to make a new leg
 */
Tarantula.prototype.shedLeg = function (leg) {
	leg.destroy();
};
/**
/**
 * Logic to process a given task
 *
 * @param {object} task
 * @param {string} task.uri
 *   The URI to process
 * @param {Client} leg
 *   Instance of a leg (aka "Client")
 * @param {function} release
 *   Will release the leg back to the pool
 */
Tarantula.prototype.follow = function (task, leg) {
	this.emit('follow', task.uri);
	leg
		.setHeaders(this.brain.headers)
		.setProxy(this.brain.proxy)
		.setListener(this.legEvent.bind(this, leg, task))
		.get(task.uri, this.visit);
};
Tarantula.prototype.legEvent = function (leg, task, eventName) {
	var args = Array.prototype.slice.call(arguments, 3);
	args.unshift(eventName, task);
	this.emit.apply(this, args);
	if (eventName === 'data' || eventName === 'error') {
		this.legs.release(leg);
		this.visited++;
	}
};
Tarantula.prototype.complete = function () {
	this.emit('done');
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
