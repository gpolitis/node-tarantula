# node-tarantula

nodejs crawler/spider which provides a simple interface for crawling the Web. Its API has been inspired by [crawler4j](http://http://code.google.com/p/crawler4j/).

## Quick Examples

```js
var brain = {

    politeness: 2000,

    shouldVisit: function(uri) {
        return true;
    },

    visit : function(request, response, body, $) {
        console.log(request.uri);
    },

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
};

var tarantula = new Tarantula(brain);

tarantula.on('done', function() { 
    console.log('done'); 
});

tarantula.start(["http://stackoverflow.com"]);
```
