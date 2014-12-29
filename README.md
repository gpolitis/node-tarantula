# node-tarantula

nodejs crawler/spider which provides a simple interface for crawling the Web. Its API has been inspired by [crawler4j](https://code.google.com/p/crawler4j/).

## Quick Examples

```js
var brain = {

    legs: 8,

    shouldVisit: function(uri) {
        return true;
    }

};

var tarantula = new Tarantula(brain);

tarantula.on('data', function (uri) {
	  console.info('200', uri);
});

tarantula.on('done', function() { 
    console.log('done'); 
});

tarantula.start(["http://stackoverflow.com"]);
```

## Phantom Usage

If you would like to use the included [PhantomJS](http://phantomjs.org/) plugin, you'll need to download and install the [PhantomJS](http://code.google.com/p/phantomjs/downloads/list) from their website. It's also on popular OS Package Managers:
 * `brew install phantomjs`
 * `apt-get install phantomjs`
