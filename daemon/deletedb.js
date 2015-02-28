var couchHost = 'localhost';
var couchPort = 5984;

var async = require('async');
var nodeCouchDb = require('node-couchdb');
var couch = new nodeCouchDb(couchHost, couchPort);

var indexDbName = 'brewberry_index';
var tempsDbName = 'brewberry_temps';
var eventsDbName = 'brewberry_events';

var tasks = [];
tasks.push(function(callback) {
  couch.dropDatabase (indexDbName, function(err) {
    if (err) { console.log('error dropping index db: %s', err); }
  });
});
tasks.push(function(callback) {
  couch.dropDatabase (tempsDbName, function(err) {
    if (err) { console.log('error dropping temps db: %s', err); }
  });
});
tasks.push(function(callback) {
  couch.dropDatabase (eventsDbName, function(err) {
    if (err) { console.log('error dropping events db: %s', err); }
  });
});

async.parallel(tasks, function(err, results) {
  if (err) { console.log('error: %s',err); }
  else { console.log('done'); }
});

