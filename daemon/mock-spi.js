var _ = require('underscore');

var mockspi = {
  transfer: function(buf1, buf2, callback) {
    var temp = 22 + (_.random(200) / 100.0);
    temp = (temp + 50) * (10.24/3.3);
    
    callback(null, new Buffer([0,(temp & 0x0300) >> 8,temp & 0xFF]));
  }
};

exports.Spi = function() {
  return mockspi;
};
exports.MODE = [];