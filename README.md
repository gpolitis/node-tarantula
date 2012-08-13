# node-tarantula

nodejs crawler/spider which provides a simple interface for crawling the Web. Its API has been inspired by [crawler4j](http://http://code.google.com/p/crawler4j/).

## Examples

```JavaScript
    var brain =  {
	
	politeness: 2000,
	
	shouldVisit: function(uri) {
	    return true;
	},
	
	visit : function(request, response, body, $) {
         console.log(body);
	},
	debug: false
    };

var tarantula = new Tarantula(brain);

tarantula.on('done', function() { console.log('done'); });

tarantula.start(["http://stackoverflow.com"]);
```