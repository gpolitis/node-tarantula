var events = require('events');
var url = require('url');
var _ = require('lodash');
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
	// {string} If you need a proxy, specify domain "127.0.0.1"
	// Sorry, no auth support yet
	proxy: '',
	// {string} If you need a proxy, specify port "8000"
	proxyPort: '',
	// {string|null} If you need a proxy w/ authentication, specify username
	proxyUser: null,
	// {string|null} If you need a proxy w/ authentication, specify password
	proxyPass: null,
	// {bool} If you want verify SSL Certs
	strictSSL: false,
};
function Tarantula (brain) {
	this.brain = _.merge({}, DefaultBrain, brain);
	this.uris = [];
	this.visited = 0;
	this.range = [];
	this.legs = new ResourcePool({
		max: this.brain.legs,
		maxUses: this.brain.legAge,
		create: this.growLeg.bind(this),
		destroy: this.shedLeg.bind(this),
		task: this.follow.bind(this),
		complete: this.complete.bind(this),
	});
	// Backward compat - map brain functions to tarantula
	if (this.brain.shouldVisit) {
		this.shouldVisit = this.brain.shouldVisit;
	}
	if (this.brain.visit) {
		this.visit = this.brain.visit;
	}
	// Conveniance - User-Agent is a header, but we provide a brain option
	if (this.brain.userAgent) {
		this.brain.headers['User-Agent'] = UserAgents[this.brain.userAgent] || this.brain.userAgent;
	}
	
	// Binding here avoids performance penalty later
	this.isInRange = this.isInRange.bind(this);

  // Listen for data events (from Leg), then pull in that data
	this.on('data', function (task, uris, pageUri) {
		this.push(uris, pageUri, task);
	});
}
Tarantula.prototype = new events.EventEmitter();

// Public Functions
// You probably do want to override as an implementor

/**
 * Visit the page looking for links, and return a list
 *
 * With Cheerio (or other parsing clients)
 *   You may not access "client-side" vars (document, window)
 *   You may access server globals.
 *
 * With PhantomJS client (or other browser clients)
 *   You may access "client-side" vars (document, window)
 *   You may not access server globals.
 *
 * @public
 * @param {jQuery} $ - A jQuery-like interface scoped to page
 * @param {string} pageUri - The URL we are visiting
 * @return {string[]} - A list of urls to crawl
 */
Tarantula.prototype.visit = function ($, pageUri) {
	var elements = $('a').toArray();
	var uris = new Array(elements.length);
	var element;
	var uri;
	for (var i = 0; i < elements.length; i++) {
		element = elements[i];
		uri = $(element).attr('href');
		uris[i] = uri;
	}
	return uris;
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
 * @param {string} pageUri
 *   The URI where these were found
 * @param {object} parentTask
 *   (optional) If not passed, we assume a root task
 * @param {string} parentTask.uri
 *   (optional) The URI where these were found
 * @param {string} parentTask.parent
 *   (optional) The URI where parentTask.uri was found
 * @fires uris
 *   With {string[]} uris, {string} parent
 *   If new URI's are enqueued
 * @return {string[]}
 *   New URI's that were pushed to the stack
 */
Tarantula.prototype.push = function (uris, pageUri, parentTask) {
	// 1. Clean-up partial urls
	if (pageUri) {
		uris = uris.map(function (uri) {
			if (uri) {
				return url.resolve(pageUri, uri);
			}
		});
	}
	// 2. Filter any empty URL's (happens)
	uris = _.filter(uris);
	// 3. Clean-up mailto: and javascript:
	uris = _.filter(uris, isValidUrl);
	// 4. Optionally, remove any anchor tags
	//    ex: http://example.com/#anchor
	if (this.brain.trimHashes) {
		uris = uris.map(trimHash);
	}
	// 5. Optionally, skip duplicate URL's
	//    otherwise, we'll likely get stuck in a loop
	if (this.brain.skipDupes) {
		uris = _.difference(_.unique(uris), this.uris);
	}
	// 6. Optionally, stay in range of the base (range) URL's
	//    Don't go to google.com, if we're on example.com
	if (this.brain.stayInRange && parentTask) {
		uris = uris.filter(this.isInRange);
	}
	// 7. Optional, custom logic from the implementor
	if (this.shouldVisit) {
		uris = uris.filter(this.shouldVisit);
	}
	// Finally, If we've got new URI's, then queue them up
	if (uris.length) {
		var tasks = uris.map(function (uri) {
			return {
				uri: uri,
				parent: pageUri
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
 *
 * @return {Client}
 *   The new client object
 */
Tarantula.prototype.growLeg = function () {
	var client;
	if (this.brain.leg === 'PhantomJS') {
		client = new PhantomClient();
	}
	else {
		client = new CheerioClient();
	}
	client.setProxy(this.brain.proxy, this.brain.proxyPort, this.brain.proxyUser, this.brain.proxyPath);
	client.setStrictSSL(this.brain.strictSSL);
	return client;
};
/**
 * Tells the Tarantula to how to make a new leg
 *
 * @param {Client} leg
 *   The client object to destory
 */
Tarantula.prototype.shedLeg = function (leg) {
	leg.destroy();
};
/**
 * Logic to process a given task
 *
 * @param {object} task
 * @param {string} task.uri
 *   The URI to process
 * @param {Client} leg
 *   An instance of a leg (client object) to follow the task.
 * @param {function} release
 *   Will release the leg back to the pool
 */
Tarantula.prototype.follow = function (task, leg) {
	this.emit('follow', task.uri);
	leg
		.setHeaders(this.brain.headers)
		.setListener(this.legEvent.bind(this, leg, task))
		.get(task.uri, this.visit);
};
/**
 * Pass on leg events up to this tarantula's listeners.
 *   If the event is data or error, then we're done with the task.
 *
 * @param {Client} leg
 *   The leg (client object) processing the task
 * @param {object} task
 *   The task object we provided the leg.
 * @param {string} eventName
 *   The name of the event sent from the Client  
 * @fires data, error, or request
 */
Tarantula.prototype.legEvent = function (leg, task, eventName) {
	var args = Array.prototype.slice.call(arguments, 3);
	args.unshift(eventName, task);
	this.emit.apply(this, args);
	if (eventName === 'data' || eventName === 'error') {
		this.legs.release(leg);
		this.visited++;
	}
};
/**
 * Determine if the provided URL is in range
 *
 * @return {boolean}
 *   True if the URL is in range 
 */
Tarantula.prototype.isInRange = function (uri) {
	if (!uri || typeof uri !== 'string') {
		return false;
	}
	for (var i = 0; i < this.range.length; i++) {
		if (uri.indexOf(this.range[i]) === 0) {
			return true;
		}
	}
	return false;
};
/**
 * Emit an event when the legs have finished their tasks
 *
 * @fires "done"
 */
Tarantula.prototype.complete = function () {
	this.emit('done');
};
/**
 * Remove Hash part of a URL
 *
 * @param {string} uri
 *   The URL to remove hash from
 * @return {string}
 *   The URL without hash
 */
function trimHash (uri) {
	var indexOfHash = uri.indexOf('#');
	return (indexOfHash != -1) ? uri.substring(0, indexOfHash) : uri;
}
/**
 * Determine if a URL is valid
 *
 * @return {boolean}
 *  True if URL is valid
 */
function isValidUrl (uri) {
	return (uri.indexOf('http:') === 0 || uri.indexOf('https:') === 0);
}

module.exports = Tarantula;
