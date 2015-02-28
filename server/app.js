var express = require('express');
var path = require('path');
var request = require('request');
var app = express();
var dbName = "BREWBERRY";
var dbUrl = "http://127.0.0.1:5984";

// hook up the db proxy
app.use('/db', function(req, res) {
  var url = dbUrl + req.url;
  req.pipe(request(url)).pipe(res);
});
// and the static page handler including the redirect for bower components
app.use('/bower_components', express.static(path.join(__dirname, '../site/bower_components/')));
app.use(express.static(path.join(__dirname, '../site/pages/')));

// check for the existence of the DB and create it if it isn't there

var server = app.listen(3000, function () {
  var host = server.address().address;
  var port = server.address().port;
  console.log('listening at http://%s:%s',host,port);
});
