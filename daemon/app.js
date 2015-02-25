var couchHost = 'localhost';
var couchPort = 5984;

var _ = require('underscore');
var async = require('async');
var nodeCouchDb = require('node-couchdb');
var couch = new nodeCouchDb(couchHost, couchPort);
var piLed = 0;
var clockPin = 21;
var mosiPin = 18;
var emptyIndexEntry = {brews: []};
var emptyBrewEntry = { adChannel: -1};
var dbName = 'brewberry';
var indexName = 'brewIndex';

var wpi, spi;
var debug = true;
var mock = true;
if (debug) {
  console.log('debug on');
}
if (mock) {
  wpi = require('./mock-wiring-pi.js');
  spi = require('./mock-spi.js');
} else {
  wpi = require('wiring-pi');
  spi = require('pi-spi');
}

var stop = false;
var ledState = [[255,128,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0]];

var outputLEDState = function(callback) {
  if (debug) { console.log('output LED state'); }
  var bitArray = new Array(144);
  for (var i = 0;i < 6;i++) {
    for (var j = 0;j < 3;j++) {
      for (var k = 0;k < 8;k++) {
        bitArray[i*24+j*8+k] = (ledState[i][j] >> k) & 1;
      }
    }
  }
  console.log('['+bitArray.join(',')+']');
  wpi.digitalWrite(clockPin, 1);
  wpi.digitalWrite(clockPin, 0);
  for ( var i = 0;i < bitArray.length;i++) {
    wpi.digitalWrite(mosiPin, bitArray[i]);
    wpi.digitalWrite(clockPin, 1);
    wpi.digitalWrite(clockPin, 0);
  }
  wpi.delay(5); // 5ms should be plenty to make sure we're over 500mS with the clock low
  wpi.digitalWrite(clockPin, 1);
};

var setupDb = function(callback) {  
  couch.listDatabases(function(err, databases) {
    if (err) { return callback(err); }
    var foundDb = false;
    _.each(databases, function(db) {
      if (db === dbName) {
        foundDb = true;
        if (debug) { console.log('found existing db'); }
      }
    });
    if (foundDb) {
      return callback(null, true);
    }
    if (debug) { console.log('creating db'); }
    // create a new database
    couch.createDatabase(dbName, function(err) {
      if (err) { return callback(err); }
      if (debug) { console.log('creating empty index'); }
      couch.insert(dbName, emptyIndexEntry, function(err, resData) {
          if (err) { return callback(err); }
        callback(null, true);
      });
    });
  });    
};

var setup = function(callback) {
  var setupFunctions = [];
  wpi.wiringPiSetupGpio();
  wpi.pinMode(clockPin, wpi.OUTPUT);
  wpi.pinMode(mosiPin, wpi.OUTPUT);
  setupFunctions.push(setupDb);
  if (debug) { console.log('setup'); } 
  async.parallel(setupFunctions, function(err, results) {
      if (err) { 
        console.log('setup error: %s', err);
        process.exit(-1);
      }
    callback();
  });
};

process.on('SIGINT', function() {
  stop = true;
});

var loop = function() {
  if (debug) {
    console.log('loop');
  }
  // check couchdb for list of channels to sample
  // sample the A/D converter
  for (var i = 0;i < 3;i++) {
    ledState[piLed][i] = Math.floor(Math.random() * 256);
  }
  outputLEDState();
  // update couchdb
  if (stop) { 
    //gpio.destroy();
  }
  else { 
    setTimeout(loop, 500); 
  }
};

setup(loop);