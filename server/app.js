var express = require('express');
var path = require('path');
var _ = require('underscore');
var request = require('request');
var app = express();
var nodeCouchDb = require('node-couchdb');
var couch = new nodeCouchDb('localhost', 5984);
var apiRouter = express.Router();
var dbName = "BREWBERRY";
var dbUrl = "http://127.0.0.1:5984";

apiRouter.get('/brews/list',function (req, res) {
  // pull the list from couchdb
  res.json([ {
    "name":"brew 1",
    "startDate":"2015-01-01 12:00:00Z",
    "endDate":"2015-01-02 12:00:00Z"
  }, {
    "name":"brew 2",
    "startDate":"2015-02-01 12:00:00Z"
  }]);
});
apiRouter.get('/brews/fetch',function (req, res) {
  if (_.isUndefined(req.query.id)) {
    res.json({"temps": []});
  } else {
    couch.get(dbName, req.query.id, function (err, resData) {
      if (err) {
        return console.error(err);
      }
      console.dir(resData);
    });
    res.json({"temps":[{"2015-01-01":"23.1"}]});
  }
});
apiRouter.post('/brews/new',function (req, res) {
  // include an optional ADC channel number
  // start date is set automatically
  // mark the brew as started in the db
  var newEntry = {};
  couch.insert(dbName, newEntry, function (err, resData) {
    if (err) {
      return console.error(err);
    }
    console.dir(resData);
  });
  res.send('new brew!');
});

apiRouter.post('/brews/finish',function (req, res) {
  // mark the finish date on a brew
  // mark the brew as finished in the db
  if (_.isUndefined(req.query.id) || _.isUndefined(req.query.rev)) {
    res.send('error missing id or rev');
  }
  couch.update(dbName, {
    _id: req.query.id,
    _rev: req.query.rev,
    finishDate: ""
  }, function (err, resData) {
    if (err) {
      return console.error(err);
    }
    console.dir(resData);
  });
  res.send('finished!');
});

// hook up the api router
app.use('/api',apiRouter);
// and db proxy
app.use('/db', function(req, res) {
  var url = dbUrl + req.url;
  req.pipe(request(utl)).pipe(res);
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
