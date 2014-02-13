/*jshint evil:true*/
/*global window, document, $ */
var PhantomJS = require('node-phantom-simple');

function PhantomClient () {
	this.headers = {};
	this.getData = function () {};
	this.listener = function () {};
	this.domTimeout = 5000;
	this.phantomSettings = {
		parameters: {
			'load-images': 'no',
			'ignore-ssl-errors': 'yes'
		}
	};
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
PhantomClient.prototype.setProxy = function (domain, port, username, password) {
	if (domain) {
		this.phantomSettings.parameters.proxy = domain;
		this.phantomSettings.parameters.proxy += port ? ':' + port : '';
		if (username) {
			this.phantomSettings.parameters['proxy-auth'] = username;
		  this.phantomSettings.parameters['proxy-auth'] += typeof password === 'string' ? ':' + password : '';
	  }
	}
	else {
		delete this.phantomSettings.parameters.proxy;
	}
	return this;
};
/**
 * Sets HTTP Headers
 *
 * @param {object} headers
 *   HTTP Headers provided with header names as object keys
 * @return this - for chaining
 */
PhantomClient.prototype.setHeaders = function (headers) {
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
PhantomClient.prototype.setHeader = function (name, val) {
	this.headers[name] = val;
	return this;
};
/**
 * Sets PhantomJS options
 *
 * @see http://phantomjs.org/api/command-line.html
 * @param {string} name - PhantomJS Command Line Option Name
 * @param {string} value - PhantomJS Command Line Option Value
 * @return this - for chaining
 */
PhantomClient.prototype.setClient = function (name, val) {
	this.phantomSettings.parameters[name] = val;
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
PhantomClient.prototype.setListener = function (listener) {
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
PhantomClient.prototype.emit = function (eventName) {
	console.log(eventName, arguments);
};
/**
 * Instantiates a PhantomJS Client
 *   Will re-insantiate Phantom if called again
 */
PhantomClient.prototype.init = function () {
	var thisClient = this;
	if (thisClient.phantom) {
		this.phantom.exit();
		this.phantom = null;
	}
	PhantomJS.create(function(err, phantom) {
		if (err || !phantom) {
			return thisClient.emit('error', 'phantom.create', err);
		}
		thisClient.phantom = phantom;
		thisClient.isReady = true;
		thisClient._get();
	}, this.phantomSettings);
	thisClient.isInitialized = true;
};
/**
 * Retreive a web page
 *
 * @param {string} uri
 *   The URI to request
 * @param {function} getData
 *   Called called once the uri has been reached
 *   Will be passed jQuery, the page uri and the window object
 */
PhantomClient.prototype.get = function (uri, getData) {
	this.uri = uri || this.uri;
	this.getData = getData || this.getData;
	if (!this.isReady && !this.isInitialized) {
		this.init();
	}
	else if (this.isReady) {
		this._get();
	}
	// Else you asked for something while PhantomJS process is starting.
	// We'll just ignore you for now.
	return this;
};
/**
 * Actually, retreive a web page. In the previous function we are delayed,
 * waiting for PhantomJS to startup.  Now, we actually retreive the page.
 */
PhantomClient.prototype._get = function () {
	var thisClient = this;
	var clientFunction = new Function([
		'var $ = window.$PhantomClient;',
		'var uri = ' + JSON.stringify(this.uri) + ';',
		'var getData = ' + this.getData.toString() + ';',
		'var data = getData.call(this, $, uri, window);',
		'return data;',
	].join("\n"));
	// Tell PhantomJS to start a new session (browser window)
	this.phantom.createPage(function(err, page) {
		if (err || !page) {
			return thisClient.emit('error', 'phatom.createPage', err, page);
		}
		thisClient.page = page;
		thisClient.emit('request', thisClient.uri);
		// Tell PhantomJS to open a web page uri
		return page.open(thisClient.uri, function(err, status) {
			if (err || status !== "success") {
				return thisClient.emit('error', 'phatom.page.open', err, status);
			}
			// Tell PhantomJS to inject jQuery script on the page
			page.includeJs('//ajax.googleapis.com/ajax/libs/jquery/2.0.3/jquery.min.js', function (err) {
				if (err) {
					return thisClient.emit('error', 'phatom.page.includeJs', err);
				}
				// Tell PhantomJS to set a variable once the DOM is loaded.
				thisClient.clientEval(function () {
					window.$PhantomClient = $.noConflict();
					window.$PhantomClient(document).ready(function(){
						window.PhantomClientReady = true;
					});
				});
				waitFor(
					// Keep checking the web page DOM for the variabe to be true
					function (onDone) {
						thisClient.clientEval(function () {
							return window.PhantomClientReady;
						}, function (result) {
							if (result === true) {
								onDone();
							}
						});
					},
					// Now that it's true, call the provided getData function
					function(){
						thisClient.clientEval(clientFunction, function (data) {
							thisClient.emit('data', data, thisClient.uri);
						});
					},
					// Taking too long, just bail out
					function(){
						thisClient.emit('error', 'DOM timeout');
					},
					thisClient.domTimeout
				);
			});
		});
	});
};
/**
 * Tell the PhantomJS process to call a function
 *
 * @param {function} clientFn
 *   Called on client web page DOM
 * @param {function} onSuccess
 *   Called once clientFn returns
 */
PhantomClient.prototype.clientEval = function (clientFn, onSuccess) {
	var thisClient = this;
	if (!onSuccess) {
		onSuccess = function () {};
	}
	thisClient.page.evaluate(clientFn, function (err, result) {
		if (err) {
			thisClient.emit('error', 'EVAL', err);
		}
		else if (onSuccess) {
			onSuccess(result);
		}
	});
};
/**
 * Kills the underlying PhantomJS process
 */
PhantomClient.prototype.destroy = function () {
	if (this.phantom) {
		this.phantom.exit();
		this.phantom = null;
	}
};
/**
 * From https://github.com/ariya/phantomjs/blob/master/examples/waitfor.js
 *
 * Wait until the test condition is true or a timeout occurs. Useful for waiting
 * on a server response or for a ui change (fadeIn, etc.) to occur.
 *
 * @param {function} testCondition
 *   Evaluates to a boolean, true if we are ready
 * @param {function} onReady
 *   Called when testCondition condition is fulfilled
 * @param {function} onTimeout
 *   Called when testCondition has not been fullfilled, and time exceeds timeout
 * @param {int} (optional) timeout
 *   Max amout of time, in milliseconds to wait, default 3000ms
 * @param {int} (optional) attemptFrequency
 *   Time, in milliseconds, to wait before attempting again, default 250ms
 */
function waitFor (testCondition, onReady, onTimeout, timeout, attemptFrequency) {
	// Default Max Timout is 3s
	// {int} How frequently to check back in. 
	var start = Date.now();
	var success = false;
	var isTimedOut = false;
	attemptFrequency = attemptFrequency || 250;
	timeout = timeout || 3000;
	var interval = setInterval(function() {
		var now = Date.now();
		var sinceStart = now - start;
		// If we've achieved success, then fantastic - stop the loop
		if (success) {
			clearInterval(interval);
		}
		// Check if we've timed out, in which case, bail
		else if ( sinceStart >= timeout ) {
			clearInterval(interval);
			isTimedOut = true;
			onTimeout();
		}
		// If not fulfilled, but we've got time on the clock, then retest
		else {
			testCondition(readyCallback);
		}
	}, attemptFrequency);

	function readyCallback () {
		if (!isTimedOut) {
			success = true;
			clearInterval(interval);
			onReady();
		}
	}
}

module.exports = PhantomClient;
