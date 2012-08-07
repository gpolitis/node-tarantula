var request = require('request');
var jsdom = require('jsdom');
var events = require('events');

var Tarantula = function(brain) {

    // default brain.
    this._brain = {
	politeness: 2000,
	visit: function(request, response, body, $) {
	    if (this.debug)
		console.log('Visits: ' + request.uri);
	},
	isSeen: function(uri) {
	    return seen.indexOf(uri) != -1;;
	},
	shouldVisit: function(uri) {
	    if (this.debug)
		console.log('Test should visit: ' + uri);
	    return true;
	},
	makeRequest: function(uri) {
	    return {uri: uri, headers: {'User-Agent': 'Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0)'} };
	},
    };

    // extend.
    for (var x in brain) this._brain[x] = brain[x];
	
    if (!brain.isSeen) {
	var seen = [];
	
	var _oldVisit = this._brain.visit;
	this._brain.visit = function(request, response, body, $) {
	    seen.push(request.uri);
	    if (this.debug)
		console.log('Saw: ' + request.uri);
	    _oldVisit(request, response, body, $);
	};
    }	
};

Tarantula.prototype = new events.EventEmitter;

Tarantula.prototype.start = function(frontier) {
    frontier = frontier || [];

    var tarantula = this;
    var brain = this._brain;

    if (brain.debug) {
	console.log('Frontier: ');
	console.log(frontier);
    }

    // frontier unseen neighbourhood.
    var nb = [];

    (function() {
	if (!frontier.length) {
	    tarantula.emit('done');
	    return; // done.
	}
	
	var uri = frontier.pop();
	
	var rq = brain.makeRequest(uri);
	var explore = arguments.callee;
	
	// TODO parallelism. Use async.
	request(rq, function (err, response, body) {
	    if (!err && response.statusCode == 200) {
		
		jsdom.env(body, [
		    'http://code.jquery.com/jquery-1.5.min.js'
		], function (errors, window) {
		    var $ = window.$;
		    // TODO error handling.
		    brain.visit(rq, response, body, $);
		    
		    $('a').each(function() {
			var l = $(this).attr('href');
			if (typeof l === 'string')
			    if (brain.shouldVisit(l))
				if (!brain.isSeen(l))
				    if (frontier.indexOf(l) == -1 && nb.indexOf(l) == -1) {
					if (brain.debug)
					    console.log('Add to neighbourhood: ' + l);
					nb.push(l);
				    }
		    });
		    
		    if (!frontier.length) {
			if (brain.debug) {
			    console.log('Frontier: ');
			    console.log(nb);
			}
			frontier = nb;
			nb = [];
		    }
		    
		    setTimeout(explore, brain.politeness);
		});
		
	    } else {
		// TODO error handling.
		console.log('error');
	    }
	});
    })();
};

module.exports = Tarantula;