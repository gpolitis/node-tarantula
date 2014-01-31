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
PhantomClient.prototype.setProxy = function (proxy) {
	if (proxy) {
		this.phantomSettings.parameters.proxy = proxy;
	}
	else {
		delete this.phantomSettings.parameters.proxy;
	}
	return this;
};
PhantomClient.prototype.setHeaders = function (headers) {
	this.headers = headers;
	return this;
};
PhantomClient.prototype.setHeader = function (name, val) {
	this.headers[name] = val;
	return this;
};
PhantomClient.prototype.setClient = function (name, val) {
	this.phantomSettings.parameters[name] = val;
	return this;
};
// Light-weight Listeners
PhantomClient.prototype.setListener = function (fn) {
	this.emit = fn;
	return this;
};
PhantomClient.prototype.emit = function () {
};
PhantomClient.prototype.init = function () {
	var thisClient = this;
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
PhantomClient.prototype.get = function (uri, getData) {
	this.uri = uri || this.uri;
	this.getData = getData || this.getData;
	if (!this.isReady && !this.isInitialized) {
		this.init();
	}
	if (this.isReady) {
		this._get();
	}
	return this;
};
PhantomClient.prototype._get = function () {
	var thisClient = this;
	var clientFunction = new Function([
		'var $ = window.$PhantomClient;',
		'var uri = ' + JSON.stringify(this.uri) + ';',
		'var getData = ' + this.getData.toString() + ';',
		'var data = getData.call(this, $, uri, window);',
		'return data;',
	].join("\n"));
	this.phantom.createPage(function(err, page) {
		if (err || !page) {
			return thisClient.emit('error', 'phatom.createPage', err, page);
		}
		thisClient.page = page;
		thisClient.emit('request', thisClient.uri);
		return page.open(thisClient.uri, function(err, status) {
			if (err || status !== "success") {
				return thisClient.emit('error', 'phatom.page.open', err, status);
			}
			page.includeJs('//ajax.googleapis.com/ajax/libs/jquery/2.0.3/jquery.min.js', function (err) {
				if (err) {
					return thisClient.emit('error', 'phatom.page.includeJs', err);
				}
				// Wait for the DOM to be loaded!
				thisClient.clientEval(function () {
					window.$PhantomClient = $.noConflict();
					window.$PhantomClient(document).ready(function(){
						window.PhantomClientReady = true;
					});
				});
				waitFor(
					function (onDone) {
						thisClient.clientEval(function () {
							return window.PhantomClientReady;
						}, function (result) {
							if (result === true) {
								onDone();
							}
						});
					},
					function(){
						thisClient.clientEval(clientFunction, function (data) {
							thisClient.emit('data', data);
						});
					},
					function(){
						thisClient.emit('error', 'DOM timeout');
					},
					thisClient.domTimeout
				);
			});
		});
	});
};
PhantomClient.prototype.clientEval = function (fn, onSuccess) {
	var thisClient = this;
	if (!onSuccess) {
		onSuccess = function () {};
	}
	thisClient.page.evaluate(fn, function (err, result) {
		if (err) {
			thisClient.emit('error', 'EVAL', err);
		}
		else if (onSuccess) {
			onSuccess(result);
		}
	});
};
PhantomClient.prototype.destroy = function () {
	if (this.phantom) {
		this.phantom.exit();
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
