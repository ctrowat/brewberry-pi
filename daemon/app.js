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
var listAllView = {
  '_id':'_design/all',
  'views': {
      'all': {
        'map': 'function(doc) { emit(doc._id, doc); }'
      }
  }
};

var newIndexEntry = function(name, adcChannel, startDate) {
  return {
    '_id':name,
    'adc_channel':adcChannel,
    'started':startDate
  };
};

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
  spiLib = require('pi-spi');
}

var stop = false;
var ledState = [[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0]];

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
    var foundIndexDb = false;
    var foundTempDb = false;
    _.each(databases, function(db) {
      if (db === indexDbName) {
        foundIndexDb = true;
        if (debug) { console.log('found existing index db'); }        
      }
      else if (db === tempDbName) {
        foundTempDb = true;
        if (debug) { console.log('found existing temp db'); }
      }
    });
    var tasks = [];
    if (!foundIndexDb) {
      tasks.push(function(callback) {
        if (debug) { console.log('creating index db'); }
        // create a new database
        couch.createDatabase(indexDbName, function(err) {
          if (err) { callback(err); }
          else { 
            if (debug) { console.log('inserting index views'); }
            couch.insert(indexDbName, listAllView, function(err) {
              if (err) { callback(err); }
              else { callback(null); }
            });
          }
        });
      });
    }
    if (!foundTempDb) {
      tasks.push(function(callback) {
        if (debug) { console.log('creating temps db'); }
        couch.createDatabase(tempDbName, function(err) {
          if (err) { callback(err); }
          else { 
            if (debug) { console.log('inserting temps views'); }
            couch.insert(tempDbName, listAllView, function(err) {
              if (err) { console.log('1'); callback(err); }
              else { callback(null); }
            });
          }
        });
      });
    }
    async.parallel(tasks, function(err, results) {
      if (err) {
        callback(err);
      } else {
        callback(null, true);
      }
    });
  });    
};

var setup = function(callback) {
  var setupFunctions = [];
  wpi.wiringPiSetupGpio();
  spi = spiLib.initialize('/dev/spidev0.0');
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
  var buf = new Buffer([1, (8+channel)<<4,0]);
  spi.transfer(buf, function(e,d) {
    if (e) console.error(e);
    else {
      var result = "";
      for (var i = 0;i < 3;i++) {
        for (var j = 0;j < 8;j++) {
          result += d[i] >> j & 1 ? "1" : "0";
        }
      }
      console.log('[%s,%s,%s] %s',d[0],d[1],d[2], result);
      var adcRead = (d[1]&3 << 8) + d[2];
      console.log('adc: %s', adcRead); 
      adcRead = (adcRead * 3.3 / 10.24) - 50.0;
      callback(null, adcRead);
    }
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
        var sampleTime = new Date();
        console.log('adc channel %s returned temp %s at %s', channel, result, 
          sampleTime.getFullYear() + '-' + sampleTime.getMonth() + '-' + sampleTime.getDate() + ' ' + sampleTime.getHours() + ':' + sampleTime.getMinutes() + ':' + sampleTime.getSeconds());
        callback(null, result);
      }
    });
  } else {
    callback(null, -40);
  }
};

var getActiveBrews = function() {
  console.log('get');
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
      // insert the value into the temps db
      for (var i = 0;i < 3;i++) {
        ledState[piLed][i] = Math.floor(Math.random() * 256);
      }
      outputLEDState();
    });
  });
};

var loop = function() {
  getActiveBrews();
  if (stop) { 
    //gpio.destroy();
  }
  else { 
    setTimeout(loop, 500); 
  }
};

setup(loop);
