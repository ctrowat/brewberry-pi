var wpi = require('wiring-pi');
wpi.wiringPiSPISetup(0, 2000000);
var buf = new Buffer([1, (8)<<4,0]);
console.log('[%s,%s,%s]',buf[0],buf[1],buf[2]);
wpi.wiringPiSPIDataRW(0, buf);
console.log('[%s,%s,%s]',buf[0],buf[1],buf[2]);

