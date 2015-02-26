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

var spiChannelId;

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
  spiChannelId = wpi.wiringPiSPISetup(0, 2000000);
  if (debug) { console.log('spiChannelId: %s',spiChannelId); }
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

var sampleAdc = function(channel) {
  // take 1 reading, throw it away, take 10 more and average them
  var buf = new Buffer([1, (8+channel)<<4,0]);
  wpi.wiringPiSPIDataRW(0, buf);
  var adcRead = (buf[1]&3 << 8) + buf[2];
  adcRead = (adcRead * 3.3 / 10.24) - 50.0;
  return adcRead;
};

var getActiveBrews = function() {
  //brewberry_index/_all_docs
  couch.get(indexDbName,'_design/all/_view/all', null, function(err, res) {
    var adcMapping = [];
    _.each(res.data.rows, function(row) {
      var adcValue;
      if (row.value.adc_channel >= 0) {
        var adcReadings = [];
        sampleAdc(row.value.adc_channel);
        for (var i = 0;i < 10;i++) {
          adcReadings[i] = sampleAdc(row.value.adc_channel);
        }
        adcValue = _.reduce(adcReadings, function(memo, num) { return memo + num; }, 0) / 10.0;
      } else {
        adcValue = 23;
      }
      console.log('%s adc channel %s value: %s', row.value._id, row.value.adc_channel, adcValue);
      // insert into temps db the value
      /*for (var i = 0;i < 3;i++) {
        ledState[piLed][i] = Math.floor(Math.random() * 256);
      }
      outputLEDState();*/
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
