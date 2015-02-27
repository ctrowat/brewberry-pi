var spi = require('pi-spi');
var spinstance = spi.initialize('/dev/spidev0.0');
spinstance.dataMode(0);
var buf = new Buffer([1,128,0,0,0,0]);
console.log('[%s,%s,%s,%s,%s,%s]',buf[0],buf[1],buf[2],buf[3],buf[4],buf[5]);
spinstance.transfer(buf, 6, function(e,d) {
	if (e) console.error(e);
	else {
	  var output = "";
	  for (var i = 0;i < 6;i++) {
	    for (var j = 0;j < 8;j++) {
	      output += (d[i] >> j) & 1 ? "1" : "0";
	    }
	  }
	  console.log('[%s,%s,%s,%s,%s,%s] (%s)',d[0],d[1],d[2],d[3],d[4],d[5], output);
	}
});


