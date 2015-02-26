exports.wiringPiSetupGpio = function() {};
exports.pinMode = function() {};
exports.digitalWrite = function() {};
exports.delay = function() {};
exports.OUTPUT = 1;
exports.wiringPiSPISetup = function() {return 1;};
exports.wiringPiSPIDataRW = function(channel, data) { 
  data[0] = 0;
  data[1] = 0;
  data[2] = 226;
};