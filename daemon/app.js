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
var emptyBrewEntry = {};
var dbName = 'brewberry';
var indexName = 'brewIndex';

var gpio, spi;
var debug = false;
if (!_.isUndefined(process.argv[2])) {
  debug = true;		
  console.log('debug on');
} else {
  gpio = require('rpi-gpio');
  spi = require('pi-spi');
}

var stop = false;
var ledState = [[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0]];

var writeBits = function(bitArray, callback) {
  if (bitArray.length === 0) { 
    return; 
  }
  gpio.write(mosiPin, bitArray.pop());
  gpio.write(clockPin, true);
  gpio.write(clockPin, false, function(err) {
    if (err) { throw err; }
    writeBits(bitArray);
  });
};
var convertToBits = function(byte) {
  var result = new Array(8);
  for(var i = 0;i < 8;i++) {
    result[i] = (byte >> i) & 1;
  }
  return result;
};
var outputLEDState = function(callback) {
  var bitArray = [];
  for (var i = 0;i < 6;i++) {
    for (var j = 0;j < 3;j++) {
      bitArray = bitArray.concat(convertToBits(ledState[i][j]));
    }
  }
  gpio.write(clockPin, false);
  writeBits(bitArray);
  gpio.write(clockPin, false);
  // sleep 1ms? or maybe we're just slow enough
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
  if (!debug) {
    setupFunctions.push(function(callback) {
      gpio.setup(clockPin, gpio.DIR_OUT, callback);
    });
    setupFunctions.push(function(callback) {
      gpio.setup(mosiPin, gpio.DIR_OUT, callback); 
    });
  }
  setupFunctions.push(setupDb);
  if (debug) {
    console.log('setup');
  } else {
    gpio.setMode(gpio.MODE_BCM);
  }
  async.parallel(setupFunctions, function(err, results) {
      if (err) { 
        if (debug) {
          console.log('setup error: %s', err);
        }
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
  // update the LEDs
  // update couchdb
  if (stop) { 
    if (!debug) {
      gpio.destroy();
    }
  }
  else { 
    setTimeout(loop, 500); 
  }
};

setup(loop);