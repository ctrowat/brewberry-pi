var couchHost = 'localhost';
var couchPort = 5984;

var _ = require('underscore');
var async = require('async');
var nodeCouchDb = require('node-couchdb');
var couch = new nodeCouchDb(couchHost, couchPort);
var piLed = 0;
var clockPin = 17;
var mosiPin = 18;
var emptyIndexEntry = {};
var emptyBrewEntry = { adChannel: -1};
var indexDbName = 'brewberry_index';
var tempDbName = 'brewberry_temps';

var wpi, spi, spiLib;
var debug = true;
var mock = false;
if (debug) {
  console.log('debug on');
}
if (mock) {
  wpi = require('./mock-wiring-pi.js');
  spiLib = require('./mock-spi.js');
} else {
  wpi = require('wiring-pi');
  spiLib = require('spi');
}

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
  console.log('['+bitArray.join('')+']');
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
      else if (db === tempDbName) {
        foundTempDb = true;
      }
    });
    if (!foundIndexDb) {
      callback("Could not locate index DB!");
    }
    if (!foundTempDb) {
      callback("Could not locate temps DB!");
    }
  });    
};

var setup = function(callback) {
  var setupFunctions = [];
  wpi.wiringPiSetupGpio();
  spi = new spiLib.Spi('/dev/spidev0.0', {'mode':spiLib.MODE['MODE_0']},function(s) { s.open(); });
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

var sampleAdc = function(channel, callback) {
  // take 1 reading, throw it away, take 10 more and average them
  var inBuf = new Buffer([1,(8+channel)<<4,0]);
  var outBuf = new Buffer([0,0,0]);
  spi.transfer(inBuf, outBuf, function(device, buf) {
    var adcRead = ((buf[1] & 0x03) << 8) + (buf[2]);
    callback(null, (adcRead * 3.3 / 10.24) - 50.0);
  });
};

var takeSample = function(channel, callback) {
  if (channel >= 0 && channel <= 7) {
    var samplesToTake = [];
    // take 11 samples
    for (var i = 0;i < 11; i++) {
      samplesToTake.push(function(innerCallback) { sampleAdc(channel, innerCallback); });
    }
    async.series(samplesToTake, function(err, results) {
      if (err) { console.log('error taking samples for channel %s: %s', channel, err); }
      else {
        var result = 0;
        // throw away the first sample and average the rest
        for (var i = 0;i<10;i++) {
          result += results[i+1];
        }
        result = result / 10.0;
        callback(null, result);
      }
    });
  } else {
    callback(null, -40);
  }
};

var getActiveBrews = function() {
  couch.get(indexDbName,'_design/all/_view/all', null, function(err, res) {
    var samplesToTake = [];
    var resultMap = [];
    _.each(res.data.rows, function(row) {
      resultMap[samplesToTake.length] = row.value._id;
      samplesToTake.push(function(callback) { takeSample(row.value.adc_channel, callback); });
    });
    async.series(samplesToTake, function(err, results) {
      _.each(results, function(result, index) {
        console.log('%s temp: %s', resultMap[index], result);
      });
      // log for 1 minute, then post the high/low/avg to the database
      // insert the value into the temps db
        var sampleTime = new Date();
        /*console.log('adc channel %s returned temp %s at %s', channel, result, 
          sampleTime.getFullYear() + '-' + sampleTime.getMonth() + '-' + sampleTime.getDate() + ' ' + sampleTime.getHours() + ':' + sampleTime.getMinutes() + ':' + sampleTime.getSeconds());*/
      for (var i = 0;i < 3;i++) {
        ledState[piLed][i] = Math.floor(Math.random() * 256);
      }
      outputLEDState();
    });
  });
};

var loop = function() {
  getActiveBrews();
  if (!stop) { 
    setTimeout(loop, 500); 
  }
};

setup(loop);
