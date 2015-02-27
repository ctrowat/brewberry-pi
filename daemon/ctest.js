var spi = require('spi');
var spinstance = new spi.Spi('/dev/spidev0.0',{'mode':spi.MODE['MODE_0']},function(s) { 
  s.open(); 
});
  var outBuf = new Buffer([1,128,0]);
  var inBuf = new Buffer([0,0,0]);
  spinstance.transfer(outBuf, inBuf, function(device, buf) {
    var output = "";
    for (var i = 0;i < 3;i++) {
      for (var j = 0;j < 8;j++) {
        output += (buf[i] << j) & 0x80  ? "1" : "0";
      }
    }
    console.log('[%s,%s,%s] (%s)',buf[0],buf[1],buf[2], output);
    console.log('%s %s %s', (buf[1] & 0x03), (buf[1] & 0x03) << 8, buf[2]);
    console.log('%s %s %s %s', 0x1F, 0xF8, 0x00, 0x00);
    var result = ((buf[1] & 0x03) << 8) + (buf[2]);
    console.log('result: %s',result);
    spinstance.close();
  });


