#!/usr/bin/env phantomjs
console.log('Loading a web page');
var page = require('webpage').create();
var url = 'http://en.wikipedia.org/';
page.onResourceRequested = function (request) {
    console.log('Request ' + JSON.stringify(request, undefined, 4));
};
page.onResourceReceived = function (response) {
    console.log('Receive ' + JSON.stringify(response, undefined, 4));
};
page.open(url, function (status) {
  console.log('Page is loaded', status);
  phantom.exit();
});
      