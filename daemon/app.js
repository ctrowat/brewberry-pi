var _ = require('underscore');
var gpio = require('rpi-gpio');
var spi = require('pi-spi');
var async = require('async');
var couch = require('node-couchdb');

var debug = false;
var stop = false;
var ledState = [[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0]];
if (!_.isUndefined(process.argv[2])) {
	debug = true;		
}

var outputLEDState = function() {
	// write the values from ledState to the WS2803
};
var setup = function() {
	if (debug) {
		console.log('setup');
	}
	gpio.setMode(gpio.MODE_BCM);
	if (!debug) {
		async.parallel([
			function(callback) {
				gpio.setup(18, gpio.DIR_OUT, callback);
			}, function(callback) {
				gpio.setup(21, gpio.DIR_OUT, callback); 
			}], function(err, results) {
				if (err) { 
					if (debug) {
						console.log('setup error: %s', err);
					}
					process.exit(-1);
				}
				loop();
			});
	} else {
		loop();
	}
};

process.on('SIGINT', function() {
	stop = true;
});

var writeBit = function(bit) {
	
};

var loop = function() {
	if (debug) {
		console.log('loop');
	}
		// monitor the A/D converter
		// update the LEDs
		// console log for now
	if (!stop) { setTimeout(loop, 500); }
	else { gpio.destroy(function() {
		if (debug) {
			console.log('destroy complete');
		}
		});
	}
};


setup();

