var request = require('request');
var cheerio = require('cheerio');
var events = require('events');
var url = require('url');
var async = require('async');

var Tarantula = function (brain) {
	// default brain.
	this._brain = {
		politeness: 2000,
		// TODO event maybe?
		visit: function (request, response, body, $) {
			if (this.debug)
				console.log('Visits: ' + request.uri);
		},
		isSeen: function (uri) {
			return seen.indexOf(uri) != -1;
		},
		shouldVisit: function (uri) {
			if (this.debug)
				console.log('Test should visit: ' + uri);
			return true;
		},
		makeRequest: function (uri) {
			return {
				uri: uri,
				headers: {
					'User-Agent': 'Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0)'
				}
			};
		},
		// TODO error handling.
		log: function (msg) {
			console.log(msg);
		},
		error: function (err, req, resp) {
			if (resp && resp.statusCode == 404) {
				console.info('URL ' + req.uri + ' not found (404)');
			} else {
				console.error(err, req, resp);
			}
		},
		nbh: function (base, $) {
			var nbh = [];
			$('a').each(function () {
				var l = $(this).attr('href');
				if (typeof l === 'string') {
					// trim hashtags.
					var indexOfHash = l.indexOf("#");
					if (indexOfHash != -1)
						l = l.substring(0, indexOfHash);
					// TODO other protocols? Error handling?
					var resolved = url.resolve(base, l);
					nbh.push(resolved);
				}
			});
			return nbh;
		},
	};
	// extend.
	for (var x in brain) this._brain[x] = brain[x];
	if (!brain.isSeen) {
		var seen = [];
		this._brain._oldVisit = this._brain.visit;
		this._brain.visit = function (request, response, body, $) {
			seen.push(request.uri);
			if (this.debug)
				console.log('Saw: ' + request.uri);
			this._oldVisit(request, response, body, $);
		};
	}
};
Tarantula.prototype = new events.EventEmitter;
Tarantula.prototype.start = function (frontier) {
	frontier = frontier || [];
	var tarantula = this;
	var brain = this._brain;
	brain.log('Frontier: ');
	brain.log(frontier);
	// frontier unseen neighbourhood.
	var nb = [];
	async.whilst(
		function () {
			return frontier.length;
		},
		function (callback) {
			var uri = frontier.pop();
			var rq = brain.makeRequest(uri);
			// TODO parallelism? Use async.
			request(rq, function (err, response, body) {
				if (!err && response.statusCode == 200) {
					var $ = cheerio.load(body);
					// TODO error handling.
					brain.visit(rq, response, body, $);
					brain.nbh(rq.uri, $).forEach(function (uri) {
						if (brain.shouldVisit(uri))
							if (!brain.isSeen(uri))
								if (frontier.indexOf(uri) == -1 && nb.indexOf(uri) == -1) {
									brain.log('Add to neighbourhood: ' + uri);
									nb.push(uri);
								}
					});
					if (!frontier.length) {
						brain.log('Frontier: ');
						brain.log(nb);
						frontier = nb;
						nb = [];
					}
					setTimeout(callback, brain.politeness);
				} else {
					brain.error(err, rq, response);
				}
			});
		},
		function (err) {
			brain.error('No more to', err);
			tarantula.emit('done');
		});
};

module.exports = Tarantula;
