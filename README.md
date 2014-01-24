# node-tarantula

nodejs crawler/spider which provides a simple interface for crawling the Web. Its API has been inspired by [crawler4j](https://code.google.com/p/crawler4j/).

## Quick Examples

```js
var brain = {

    leg: 8,

    shouldVisit: function(uri) {
        return true;
    }

};

var tarantula = new Tarantula(brain);

tarantula.on('visit', function (uri, req, resp) {
	  console.info('200', uri);
});

tarantula.on('done', function() { 
    console.log('done'); 
});

tarantula.start(["http://stackoverflow.com"]);
```
