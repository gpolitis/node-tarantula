var request = require('request');
var cheerio = require('cheerio');

// TODO Use event emitter.
module.exports = function tarantula(frontier, options, cbShouldVisit, cbVisit, cbIsSeen) {
    
    // setup some defaults.
    (function() {
	frontier = frontier || [];
	
	options = options || {};
	
	cbShouldVisit = cbShouldVisit || function(uri) {
	    console.log('Test should visit: ' + uri);
	    return true;
	};
	
	cbVisit = cbVisit || function(request, response, body, $) {
	    console.log('Visits: ' + request.uri);
	};
	
	var handleSeen = !cbIsSeen;
	if (handleSeen) {
	    var seen = [];
	    
	    var _oldVisit = cbVisit;
	    cbVisit = function(request, response, body, $) {
		seen.push(request.uri);
		_oldVisit(request, response, body, $);
	    };
	    
	    cbIsSeen = function(uri) {
		var ret = seen.indexOf(uri) != -1;
		return ret;
	    };
	}
    })();
    
    // frontier unseen neighbourhood.
    var nb = [];
    
    (function() {
	
	if (!frontier.length)
	    return; // done.
	
	var uri = frontier.pop();
	
	var rq = {uri: uri };
	var self = arguments.callee;
	
	// TODO parallelism. Use async.
	request(rq, function (err, response, body) {
	    if (!err && response.statusCode == 200) {
		
		$ = cheerio.load(body);
		// TODO error handling.
		cbVisit(rq, response, body, $);
		
		$('a').each(function() {
		    var l = $(this).attr('href');
		    if (typeof l === 'string')
			if (cbShouldVisit(l))
			    if (!cbIsSeen(l))
				if (frontier.indexOf(l) == -1 && nb.indexOf(l) == -1)
				    nb.push(l);
		});
		
		if (!frontier.length) {
		    frontier = nb;
		    nb = [];
		}
		
		setTimeout(self, options.politeness);
	    } else {
		// TODO error handling.
	    }
	});
    })();
};