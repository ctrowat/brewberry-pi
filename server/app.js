var express = require('express');
var path = require('path');
var _ = require('underscore');
var app = express();

var apiRouter = express.Router();

apiRouter.get('/brews/list',function (req, res) {
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
    res.json({"temps":[{"2015-01-01":"23.1"}]});
  }
});
apiRouter.post('/brews/new',function (req, res) {
  
  res.send("new brew!");
});

//apiRouter.use(function (req, res, next) {
//  console.log('apiRouter: %s %s %s', req.method, req.url, req.path);
//});

// hook up the api router
app.use('/api',apiRouter);
// and the static page handler including the redirect for bower components
app.use('/bower_components', express.static(path.join(__dirname, '../site/bower_components/')));
app.use(express.static(path.join(__dirname, '../site/pages/')));

var server = app.listen(3000, function () {
  var host = server.address().address;
  var port = server.address().port;
  console.log('listening at http://%s:%s',host,port);
});
