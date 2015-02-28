var couchHost = 'localhost';
var couchPort = 5984;

var async = require('async');
var nodeCouchDb = require('node-couchdb');
var couch = new nodeCouchDb(couchHost, couchPort);

var indexView = {
  '_id':'_design/index_db',
  'views': {
    'all': {
      'map': 'function(doc) { emit(doc._id, doc); }'
    }
  }
};

var tempsView = {
  '_id':'_design/temps_db',
  'views': {
    'by_name': {
      'map': 'function(doc) { emit(doc.name, doc); }'
    },
    'by_id': {
      'map': 'function(doc) { emit(doc._id, doc); }'
    }
  }
};

var eventsView = {
  '_id':'_design/events_db',
  'views': {
    'all': {
      'map': 'function(doc) { emit(doc._id, doc); }'
    },
    'by_date': {
      'map': 'function(doc) { emit(doc.date, doc); }'
    }
  }
};

var indexDbName = 'brewberry_index';
var tempsDbName = 'brewberry_temps';
var eventsDbName = 'brewberry_events';

var tasks = [];
tasks.push(function(callback) {
  couch.createDatabase(indexDbName, function(err) {
    if (err) { console.log('error creating index db: %s', err); }
    else { 
      couch.insert(indexDbName, indexView, function(err) {
        if (err) { console.log('error inserting index views: %s', err);; }
      });
    }
  });
});
tasks.push(function(callback) {
  couch.createDatabase(tempsDbName, function(err) {
    if (err) { console.log('error creating temps db: %s', err); }
    else { 
      couch.insert(tempsDbName, tempsView, function(err) {
        if (err) {console.log('error inserting temps views: %s',err); }
      });
    }
  });
});
tasks.push(function(callback) {
  couch.createDatabase(eventsDbName, function(err) {
    if (err) { console.log('error creating events db: %s', err); }
    else { 
      couch.insert(eventsDbName, eventsView, function(err) {
        if (err) { console.log('error inserting events views: %s', err);; }
      });
    }
  });
});

async.parallel(tasks, function(err, results) {
  if (err) { console.log('error: %s',err); }
  else { console.log('done'); }
});

