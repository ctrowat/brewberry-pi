var couchHost = 'localhost';
var couchPort = 5984;

var _ = require('underscore');
var async = require('async');
var nodeCouchDb = require('node-couchdb');
var argv = require('minimist')(process.argv.slice(2));
require('./date.js');
var couch = new nodeCouchDb(couchHost, couchPort);
var piLed = 0;
var clockPin = 17;
var mosiPin = 18;
var emptyIndexEntry = {};
var emptyBrewEntry = { adChannel: -1};
var indexDbName = 'brewberry_index';
var tempsDbName = 'brewberry_temps';
var eventsDbName = 'brewberry_events';
var collectInterval = 1000; // ms
var ledInterval = 50; // ms
var saveInterval = 300; // * collectInterval

var wpi, spi, spiLib;

var mock = _.contains(argv._, 'mock');
if (mock) {
  wpi = require('./mock-wiring-pi.js');
  spiLib = require('./mock-spi.js');
  console.log('mocking inputs');
} else {
  wpi = require('wiring-pi');
  spiLib = require('spi');
}
var storedTemps = {};
var stop = false;
var statusLedHue = 0.0;
var ledState = [[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0]];

var HSVToRGB = function (h, s, v) {
    var r, g, b, i, f, p, q, t;
    if (h && s === undefined && v === undefined) {
        s = h.s, v = h.v, h = h.h;
    }
    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }
    return {
        r: Math.floor(r * 255),
        g: Math.floor(g * 255),
        b: Math.floor(b * 255)
    };
};

var outputLEDState = function() {
  var rgb = HSVToRGB(statusLedHue,1,0.05);
  ledState[piLed][0] = rgb.r;
  ledState[piLed][1] = rgb.g;
  ledState[piLed][2] = rgb.b;
  statusLedHue += 0.02;
  if (statusLedHue > 1) { statusLedHue = 0; }
  var bitArray = new Array(144);
  for (var i = 0;i < 6;i++) {
    for (var j = 0;j < 3;j++) {
      for (var k = 0;k < 8;k++) {
        bitArray[i*24+j*8+k] = (ledState[i][j] >> k) & 1;
      }
    }
  }
  wpi.digitalWrite(clockPin, 1);
  wpi.digitalWrite(clockPin, 0);
  for ( var i = 0;i < bitArray.length;i++) {
    wpi.digitalWrite(mosiPin, bitArray[i]);
    wpi.digitalWrite(clockPin, 1);
    wpi.digitalWrite(clockPin, 0);
  }
  wpi.delay(2); // 5ms should be plenty to make sure we're over 500mS with the clock low
  wpi.digitalWrite(clockPin, 1);
  if (!stop) { 
    setTimeout(outputLEDState, ledInterval);
  }
};

var setupDb = function(callback) {  
  couch.listDatabases(function(err, databases) {
    if (err) { return callback(err); }
    var foundIndexDb = false;
    var foundTempDb = false;
    var foundEventsDb = false;
    _.each(databases, function(db) {
      if (db === indexDbName) {
        foundIndexDb = true;
      }
      else if (db === tempsDbName) {
        foundTempDb = true;
      }
      else if (db === eventsDbName) {
        foundEventsDb = true;
      }
    });
    if (!foundIndexDb) {
      return callback("Could not locate index DB!");
    }
    if (!foundTempDb) {
      return callback("Could not locate temps DB!");
    }
    if (!foundEventsDb) {
      return callback('Count not locate events DB!');
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
    getActiveBrews();
    outputLEDState();
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

var takeSample = function(id, config, callback) {
  var samplesToTake = [];
  // take 11 samples
  for (var i = 0;i < 11; i++) {
    samplesToTake.push(function(innerCallback) { sampleAdc(config.adc_channel, innerCallback); });
  }
  async.series(samplesToTake, function(err, results) {
    if (err) { 
      console.log('error taking samples for channel %s: %s', config.adc_channel, err); 
      callback(err);
    }
    else {
      var result = 0;
      // throw away the first sample and average the rest
      for (var i = 0;i<10;i++) {
        result += results[i+1];
      }
      result = result / 10.0;
      callback(null, {id: id, config: config, result: result});
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
    if (err) { console.log(err); return; } // just skip this pass if the db returns an error
    var resultMap = [];
    var samplesToTake = {};
    _.each(res.data.rows, function(row) {
      if (row.value.start_date && !row.value.finished_date) { // check if the brew has started
        if (row.value.adc_channel >= 0 && row.value.adc_channel <= 7) {
          samplesToTake[row.value._id] = {
            adc_channel: row.value.adc_channel,
            maxTemp: row.value.maxTemp,
            minTemp: row.value.minTemp
          };
        } else {
          console.log('brew %s has invalid channel %s', row.value._id, row.value.adc_channel);
        }
      }
    });
    var calls = _.map(_.pairs(samplesToTake), createSampleCallback);
    async.series(calls , function(err, results) {
      var newTemps = {};
      _.each(results, function(result) {
        if (_.isUndefined(storedTemps[result.id])) { storedTemps[result.id] = {temps:[]}; }
        storedTemps[result.id].temps.push(result.result);
        storedTemps[result.id].minTemp = result.config.minTemp;
        storedTemps[result.id].maxTemp = result.config.maxTemp;
      });
      _.each(_.keys(storedTemps), function(key) {
        if (!_.findKey(results, function(prop) { return prop.id === key; })) {
          delete storedTemps[key];
        } else {
          if (storedTemps[key].temps.length >= saveInterval) {
            var sampleTime = new Date();
            var dateString = sampleTime.toString('yyyy-MM-dd HH:mm:ss');
            var averageTemp = Math.round(_.reduce(storedTemps[key].temps, function(memo, num){ return memo + num; }, 0) / storedTemps[key].temps.length * 100) / 100;
            storedTemps[key].temps = [];
            var saveData = {
              brew_id: key,
              date: dateString,
              temp: averageTemp
            };
            if (saveData.temp > storedTemps[key].maxTemp) { console.log('over temp on %s',key); }
            if (saveData.temp < storedTemps[key].minTemp) { console.log('under temp on %s',key); }
            var tempEventObject = {brew_id: key, event_type: 'OKAY'};
            // query events table for this key - do we already know?
            couch.get(eventsDbName, '_design/events/_view/by_date', {key: key}, function(err, res) {
              if (!err) {
                console.dir(res);
                // before saving check if we've logged an error recently, we shouldn't log more often than every 10-15 minutes
                // email when we go out of range, and maybe when we go back in
                // if over/under temp log to the events table
              } else {
                console.dir(err);
              }
              couch.insert(tempsDbName, saveData, function(err, data) {
                if (err) { console.log('error saving data for %s: %s',key, err); }
              });
            });
          }
        }
      });
      if (!stop) { 
        setTimeout(getActiveBrews, collectInterval); 
      }      
    });
  });
};

setup();
