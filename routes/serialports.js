var express = require('express');
var router = express.Router();
var waterfall = require('async-waterfall');
var async = require('async');
var serialPort = require("serialport");
var SerialPort = require("serialport").SerialPort

var allPorts = [];
var dataRecordBySerialNumber = [];


function stripTrailingBarAndTrim(str){
    return str.substring(0, str.lastIndexOf("|")).trim();
}

function backedUpOrNot(str){
    if(str.trim() == ""){
        return "Backed Up";
    }
    else{
        return "NOT Backed Up";
    }
}

function openSerialPort(portName, obj, callback){

    var fieldStringSplitMap = [
        {"  |       Firmware Version ": ["Shipped Firmware Version", stripTrailingBarAndTrim]},
        {"    MAC Address: ": ["CC3000 MAC address", null]},
        {" MQTT Password backed up?": ["Open Sensors .io password", backedUpOrNot]},
        {"    CO Sensitivity [nA/ppm]: ": ["CO Sensitivity", null]},
        {"    CO Offset [V]: ": ["CO Sensor Zero Value", null]},
        {"    NO2 Sensitivity [nA/ppm]: ": ["NO2 Sensitivity", null]},
        {"    NO2 Offset [V]: ": ["NO2 Sensor Zero Value", null]}
    ];

    var sp = new SerialPort(portName, {
        baudrate: 115200,
        parser: serialPort.parsers.readline("\n")
    });

    var lineCount = 0;
    var serialNumber = null;
    var firmwareVersion = null;

    sp.on("open", function () {
        console.log('open');
        sp.on('data', function(data) {
            console.log('line ' + lineCount + ': ' + data);
            lineCount++;
            if(lineCount == 20){
                sp.write("aqe\r");
            }

            var parts = data.trim().split("Egg Serial Number: ");
            if(parts.length == 2){
                serialNumber = parts[1];
                if(obj) {
                    obj.serialNumber = serialNumber;
                    allPorts.push(obj);
                }
                dataRecordBySerialNumber[serialNumber] = {};
                dataRecordBySerialNumber[serialNumber]["Shipped Firmware Version"] = [firmwareVersion];
            }

            parts = data.split("   Firmware Version ");
            if(parts.length > 1){
                firmwareVersion = stripTrailingBarAndTrim(parts[1]);
            }
            else{
                var found = false;
                for(var entry in fieldStringSplitMap){
                    for(var key in fieldStringSplitMap[entry]){ // there will only be one
                        parts = data.split(key);
                        if(parts.length > 1){
                            found = true;
                            var arg = null;
                            if(parts[0].length > 0){
                                if(fieldStringSplitMap[entry][key][1] == null){
                                    arg = parts[0].trim();
                                }
                                else{
                                    arg = fieldStringSplitMap[entry][key][1](parts[0])
                                }
                            }
                            else{
                                if(fieldStringSplitMap[entry][key][1] == null){
                                    arg = parts[1].trim();
                                }
                                else{
                                    arg = fieldStringSplitMap[entry][key][1](parts[1])
                                }
                            }

                            dataRecordBySerialNumber[serialNumber][fieldStringSplitMap[entry][key][0]] = [arg];
                            break;
                        }
                    }

                    if(found){
                        break;
                    }
                }
            }

            if(serialNumber && lineCount > 80){
                sp.close(function(){
                    console.log("close");
                    console.log(dataRecordBySerialNumber);
                    callback(null);
                });
            }
        });
    });
}

router.get('/:serialNumber', function(req, res, next) {
    res.json(dataRecordBySerialNumber[req.param("serialNumber")]);
});

function commitValuesToSerialPort(objData, portName, callback){
    var sp = new SerialPort(portName, {
        baudrate: 115200,
        parser: serialPort.parsers.readline("\n")
    });

    var lineCount = 0;
    sp.on("open", function () {
        console.log('open');
        sp.on('data', function (data) {
            console.log('line ' + lineCount + ': ' + data);
            lineCount++;
            if (lineCount == 20) {
                waterfall([
                    function(callback){
                        setTimeout(function(){
                            sp.write("aqe\r");
                            callback(null);
                        }, 500);
                    },
                    function(callback){
                        setTimeout(function(){
                            sp.write("no2_sen " + Math.abs(parseFloat(objData["no2-sensitivity"])) + "\r");
                            callback(null);
                        }, 500);
                    },
                    function(callback){
                        setTimeout(function(){
                            sp.write("no2_off " + objData["no2-offset"].trim() + "\r");
                            callback(null);
                        }, 500);
                    },
                    function(callback){
                        setTimeout(function(){
                            sp.write("co_sen " + Math.abs(parseFloat(objData["co-sensitivity"])) + "\r");
                            callback(null);
                        }, 500);
                    },
                    function(callback){
                        setTimeout(function(){
                            sp.write("co_off " + objData["co-offset"].trim() + "\r");
                            callback(null);
                        }, 500);
                    },
                    function(callback){
                        setTimeout(function(){
                            sp.write("mqttpwd " + objData["mqtt-password"].trim() + "\r");
                            callback(null);
                        }, 500);
                    },
                    function(callback){
                        setTimeout(function(){
                            sp.write("backup all\r");
                            callback(null);
                        }, 500);
                    },
                    function(callback){
                        setTimeout(function(){
                            sp.write("restore defaults\r");
                            callback(null);
                        }, 500);
                    }
                ],
                function(err){

                });
            }

            if(lineCount == 100){
                setTimeout(function(){
                    sp.close();
                    callback(null);
                }, 5000);
            }
        });
    });


}

router.post('/commit/:serialNumber', function(req, res, next) {
    var found_it = false;

    for(var entry in allPorts){
        if(allPorts[entry]["serialNumber"] == req.param("serialNumber")) {
            found_it = true;
            console.log(req.body);

            waterfall([
                function (callback) {
                    commitValuesToSerialPort(req.body, allPorts[entry].comName, callback);
                }
            ],
            function (err, result) {
                res.json({"status": "OK"});
            });
            break;
        }
    }

    if(!found_it) {
        res.json({"status": "Not Found"});
    }
});

router.get('/', function(req, res, next) {
    allPorts = [];
    dataRecordBySerialNumber = [];

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
                            openSerialPort(port.comName, obj, callback)
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