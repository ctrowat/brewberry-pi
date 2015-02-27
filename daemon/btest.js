var spi = require('pi-spi');
var spinstance = spi.initialize('/dev/spidev0.0');

var buf = new Buffer([1, (8)<<4,0]);
console.log('[%s,%s,%s]',buf[0],buf[1],buf[2]);
spinstance.transfer(buf, buf.length, function(e,d) {
	if (e) console.error(e);
	else {
	  var output = "";
	  for (var i = 0;i < 3;i++) {
	    for (var j = 0;j < 8;j++) {
	      output += (d[i] >> j) & 1 ? "1" : "0";
	    }
	  }
	  console.log('[%s,%s,%s] (%s)',d[0],d[1],d[2], output);
	}
});


