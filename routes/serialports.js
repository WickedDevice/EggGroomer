var express = require('express');
var router = express.Router();
var waterfall = require('async-waterfall');
var async = require('async');
var serialPort = require("serialport");
var SerialPort = require("serialport").SerialPort

router.get('/', function(req, res, next) {
    var allPorts = [];

    waterfall(
        [
            function(callback){
                serialPort.list(function (err, ports) {
                    async.forEach(ports, function(port, callback) {
                        var obj = {};
                        obj.comName = port.comName;
                        obj.pnpId = port.pnpId;
                        obj.manufacturer = port.manufacturer;
                        if(obj.manufacturer == "FTDI") {
                            var sp = new SerialPort(port.comName, {
                                baudrate: 115200,
                                parser: serialPort.parsers.readline("\n")
                            });

                            var lineCount = 0;
                            var serialNumber = null;
                            sp.on("open", function () {
                                console.log('open');
                                sp.on('data', function(data) {
                                    console.log('line: ' + lineCount + ': ' + data);
                                    lineCount++;
                                    if(lineCount == 7){
                                        sp.write("aqe\r");
                                    }

                                    var parts = data.trim().split("Egg Serial Number: ");
                                    if(parts.length == 2){
                                        serialNumber = parts[1];
                                        obj.serialNumber = serialNumber;
                                        allPorts.push(obj);
                                    }

                                    if(serialNumber){
                                        sp.close(function(){
                                            callback(null);
                                        });
                                    }
                                });
                            });
                        }
                    },
                    function(err) {
                        callback(null);
                    });
                });
            }
        ],
        function(err, result){
            res.json(allPorts);
        }
    );


});

module.exports = router;