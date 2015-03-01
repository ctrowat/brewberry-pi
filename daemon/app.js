var couchHost = 'localhost';
var couchPort = 5984;

var _ = require('underscore');
var async = require('async');
var nodeCouchDb = require('node-couchdb');
require('./date.js');
var couch = new nodeCouchDb(couchHost, couchPort);
var piLed = 0;
var clockPin = 17;
var mosiPin = 18;
var emptyIndexEntry = {};
var emptyBrewEntry = { adChannel: -1};
var indexDbName = 'brewberry_index';
var tempsDbName = 'brewberry_temps';
var collectInterval = 500; // ms
var saveInterval = 120; // * collectInterval

var wpi, spi, spiLib;

var mock = true;
if (mock) {
  wpi = require('./mock-wiring-pi.js');
  spiLib = require('./mock-spi.js');
} else {
  wpi = require('wiring-pi');
  spiLib = require('spi');
}
var storedTemps = {};
var stop = false;
var ledState = [[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0]];

var outputLEDState = function(callback) {
  var bitArray = new Array(144);
  for (var i = 0;i < 6;i++) {
    for (var j = 0;j < 3;j++) {
      for (var k = 0;k < 8;k++) {
        bitArray[i*24+j*8+k] = (ledState[i][j] >> k) & 1;
      }
    }
  }
  //console.log('['+bitArray.join('')+']');
  wpi.digitalWrite(clockPin, 1);
  wpi.digitalWrite(clockPin, 0);
  for ( var i = 0;i < bitArray.length;i++) {
    wpi.digitalWrite(mosiPin, bitArray[i]);
    wpi.digitalWrite(clockPin, 1);
    wpi.digitalWrite(clockPin, 0);
  }
  wpi.delay(2); // 5ms should be plenty to make sure we're over 500mS with the clock low
  wpi.digitalWrite(clockPin, 1);
};

var setupDb = function(callback) {  
  couch.listDatabases(function(err, databases) {
    if (err) { return callback(err); }
    var foundIndexDb = false;
    var foundTempDb = false;
    _.each(databases, function(db) {
      if (db === indexDbName) {
        foundIndexDb = true;
      }
      else if (db === tempsDbName) {
        foundTempDb = true;
      }
    });
    if (!foundIndexDb) {
      return callback("Could not locate index DB!");
    }
    if (!foundTempDb) {
      return callback("Could not locate temps DB!");
    }
    callback(null);
  });    
};

var setup = function(callback) {
  var setupFunctions = [];
  wpi.wiringPiSetupGpio();
  spi = new spiLib.Spi('/dev/spidev0.0', {'mode':spiLib.MODE['MODE_0']},function(s) { s.open(); });
  wpi.pinMode(clockPin, wpi.OUTPUT);
  wpi.pinMode(mosiPin, wpi.OUTPUT);
  setupFunctions.push(setupDb);
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

var sampleAdc = function(channel, callback) {
  // take 1 reading, throw it away, take 10 more and average them
  var inBuf = new Buffer([1,(8+channel)<<4,0]);
  var outBuf = new Buffer([0,0,0]);
  spi.transfer(inBuf, outBuf, function(device, buf) {
    var adcRead = ((buf[1] & 0x03) << 8) + (buf[2]);
    callback(null, (adcRead * 3.3 / 10.24) - 50.0);
  });
};

var takeSample = function(id, channel, callback) {
  var samplesToTake = [];
  // take 11 samples
  for (var i = 0;i < 11; i++) {
    samplesToTake.push(function(innerCallback) { sampleAdc(channel, innerCallback); });
  }
  async.series(samplesToTake, function(err, results) {
    if (err) { 
      console.log('error taking samples for channel %s: %s', channel, err); 
      callback(err);
    }
    else {
      var result = 0;
      // throw away the first sample and average the rest
      for (var i = 0;i<10;i++) {
        result += results[i+1];
      }
      result = result / 10.0;
      callback(null, {id: id, channel: channel, result: result});
    }
  });
};

var createSampleCallback = function(pair) {
  return function(innerCallback) {
    takeSample(pair[0], pair[1], innerCallback);
  };
};

var getActiveBrews = function() {
  couch.get(indexDbName,'_design/index_db/_view/all', null, function(err, res) {
    var resultMap = [];
    var samplesToTake = {};
    _.each(res.data.rows, function(row) {
      if (row.value.start_date && !row.value.finished_date) { // check if the brew has started
        if (row.value.adc_channel >= 0 && row.value.adc_channel <= 7) {
          samplesToTake[row.value._id] = row.value.adc_channel;
        } else {
          console.log('brew %s has invalid channel %s', row.value._id, row.value.adc_channel);
        }
      }
    });
    var calls = _.map(_.pairs(samplesToTake), createSampleCallback);
    async.series(calls , function(err, results) {
      var newTemps = {};
      _.each(results, function(result) {
        if (_.isUndefined(storedTemps[result.id])) { storedTemps[result.id] = []; }
        storedTemps[result.id].push(result.result);
      });
      _.each(_.keys(storedTemps), function(key) {
        if (!_.findKey(results, function(prop) { return prop.id === key; })) {
          delete storedTemps[key];
        } else {
          if (storedTemps[key].length >= saveInterval) {
            var sampleTime = new Date();
            var dateString = sampleTime.toString('yyyy-MM-dd HH:mm:ss');
            var averageTemp = Math.round(_.reduce(storedTemps[key], function(memo, num){ return memo + num; }, 0) / storedTemps[key].length * 100) / 100;
            storedTemps[key] = [];
            var saveData = {
              brew_id: key,
              date: dateString,
              temp: averageTemp
            };
            couch.insert(tempsDbName, saveData, function(err, data) {
              if (err) { console.log('error saving data for %s: %s',key, err); }
            });
          }
        }
      });
      // update LED state as appropriate
      for (var i = 0;i < 3;i++) {
        ledState[piLed][i] = Math.floor(Math.random() * 256);
      }
    });
  });
};

var loop = function() {
  getActiveBrews();
  outputLEDState();
  if (!stop) { 
    setTimeout(loop, collectInterval); 
  }
};

setup(loop);
