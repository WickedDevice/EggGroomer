var express = require('express');
var router = express.Router();
var waterfall = require('async-waterfall');
var async = require('async');
var serialPort = require("serialport");
var SerialPort = require("serialport").SerialPort

var allPorts = [];
var dataRecordBySerialNumber = [];

var openHandles = [];
var currentCalibrationValues = {};

function isNumeric(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
}

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
        {"    NO2 Offset [V]: ": ["NO2 Sensor Zero Value", null]},
        {"    Temperature Reporting Offset [degC]: ": ["Temperature Offset", null]},
        {"    Humidity Reporting Offset [%]: ": ["Humidity Offset", null]},
        {"    MQTT Client ID: ": ["OpenSensors Username", null]}
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
            if(lineCount == 21){
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
                dataRecordBySerialNumber[serialNumber]["comName"] = portName;
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

router.get('/data/:serialNumber', function(req, res, next) {
    res.json(dataRecordBySerialNumber[req.query.serialNumber]);
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
            if (lineCount == 21) {
                waterfall([
                    function(callback){
                        setTimeout(function(){
                            console.log("wrote aqe");
                            sp.write("aqe\r");
                            callback(null);
                        }, 500);
                    },
                    function(callback){
                        setTimeout(function(){
                            sp.write("no2_sen " + Math.abs(parseFloat(objData["no2-sensitivity"])) + "\r");
                            console.log("wrote no2_sen " + Math.abs(parseFloat(objData["no2-sensitivity"])));
                            callback(null);
                        }, 500);
                    },
                    function(callback){
                        setTimeout(function(){
                            sp.write("no2_off " + objData["no2-offset"].trim() + "\r");
                            console.log("wrote no2_off " + objData["no2-offset"].trim());
                            callback(null);
                        }, 500);
                    },
                    function(callback){
                        setTimeout(function(){
                            sp.write("co_sen " + Math.abs(parseFloat(objData["co-sensitivity"])) + "\r");
                            console.log("wrote co_sen " + Math.abs(parseFloat(objData["co-sensitivity"])));
                            callback(null);
                        }, 500);
                    },
                    function(callback){
                        setTimeout(function(){
                            sp.write("co_off " + objData["co-offset"].trim() + "\r");
                            console.log("wrote co_off " + objData["co-offset"].trim());
                            callback(null);
                        }, 500);
                    },
                    function(callback){
                        setTimeout(function(){
                            sp.write("mqttpwd " + objData["mqtt-password"].trim() + "\r");
                            console.log("wrote mqttpwd " + objData["mqtt-password"].trim());
                            callback(null);
                        }, 500);
                    },
                    function(callback){
                        setTimeout(function(){
                            sp.write("backup all\r");
                            console.log("wrote backup all");
                            callback(null);
                        }, 500);
                    },
                    function(callback){
                        setTimeout(function(){
                            sp.write("restore defaults\r");
                            console.log("wrote restore defaults");
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
                    console.log("serial port closed.");
                    callback(null);
                }, 5000);
            }
        });
    });


}

router.get('/startcalibration', function(req, res, next) {
    async.forEach(allPorts, function(port, callback) {
        var sp = new SerialPort(port.comName, {
            baudrate: 115200,
            parser: serialPort.parsers.readline("\n")
        });

        var lineCount = 0;
        sp.on("open", function () {
            console.log('open');

            openHandles.push(sp);

            sp.on('data', function (data) {
                console.log('line ' + lineCount + ': ' + data);
                lineCount++;
                if (lineCount == 21) {
                    waterfall([
                            function (callback) {
                                setTimeout(function () {
                                    console.log("wrote aqe");
                                    sp.write("aqe\r");
                                    callback(null);
                                }, 500);
                            },
                            function (callback) {
                                setTimeout(function () {
                                    console.log("wrote opmode offline");
                                    sp.write("opmode offline\r");
                                    callback(null);
                                }, 500);
                            },
                            function (callback) {
                                setTimeout(function () {
                                    console.log("wrote temp_off 0");
                                    sp.write("temp_off 0\r");
                                    callback(null);
                                }, 500);
                            },
                            function (callback) {
                                setTimeout(function () {
                                    console.log("wrote hum_off 0");
                                    sp.write("hum_off 0\r");
                                    callback(null);
                                }, 500);
                            },
                            function (callback) {
                                setTimeout(function () {
                                    console.log("wrote backup all");
                                    sp.write("backup all\r");
                                    callback(null);
                                }, 500);
                            },
                            function (callback) {
                                setTimeout(function () {
                                    console.log("wrote exit");
                                    sp.write("exit\r");
                                    callback(null);
                                }, 500);
                            }
                        ],
                        function (err) {
                            console.log("done for now.")
                            callback(null);
                        });

                }
                else {
                    // if the line starts with "csv:" pull the current values out and store them in a global
                    if (data.trim().slice(0, 4) == "csv:") {
                        parts = data.trim().slice(4).split(",");
                        if(parts.length > 2 && isNumeric(parts[1])){
                            if(!currentCalibrationValues[port.serialNumber]) {
                                currentCalibrationValues[port.serialNumber] = {};
                            }
                            currentCalibrationValues[port.serialNumber]["Temperature"] = parseFloat(parts[1]);
                        }

                        if(parts.length > 3 && isNumeric(parts[2])){
                            if(!currentCalibrationValues[port.serialNumber]) {
                                currentCalibrationValues[port.serialNumber] = {};
                            }
                            currentCalibrationValues[port.serialNumber]["Humidity"] = parseFloat(parts[2]);
                        }
                    }
                }
            });
        });
    },function(err){
        res.json(allPorts);
    });
});

router.get('/stopcalibration', function(req, res, next) {
    async.forEach(openHandles, function(sp, callback){
        sp.close(function(){
            console.log("close");
            callback(null);
        });
    },
    function(err) {
        res.json({status: "OK"});
    });
});

// this will get polled periodically to update the front end
router.get("/currentcalibrationdata", function(req, res, next){
    res.json(currentCalibrationValues);
});

router.post('/applycalibrations', function(req, res, next) {
    // I have no idea why i have to jump through hoops here
    var obj = req.body;
    for(var key in obj){
        obj = JSON.parse(key);
        break;
    }

    console.log(obj);
    async.forEach(allPorts, function(port, callback) {
        var sp = new SerialPort(port.comName, {
            baudrate: 115200,
            parser: serialPort.parsers.readline("\n")
        });

        var lineCount = 0;
        var serialNumber = port.serialNumber;

        if(!obj[serialNumber]){ // no data for this port was sent
            callback(null);
        }
        else {
            var temp_off = obj[serialNumber]["temp_off"];
            var hum_off = obj[serialNumber]["hum_off"];

            sp.on("open", function () {
                console.log('open');
                sp.on('data', function (data) {
                    console.log('line ' + lineCount + ': ' + data);
                    lineCount++;
                    if (lineCount == 21) {
                        waterfall([
                                function (callback) {
                                    setTimeout(function () {
                                        console.log("wrote aqe");
                                        sp.write("aqe\r");
                                        callback(null);
                                    }, 500);
                                },
                                function (callback) {
                                    setTimeout(function () {
                                        console.log("wrote temp_off " + temp_off);
                                        sp.write("temp_off " + temp_off + "\r");
                                        callback(null);
                                    }, 500);
                                },
                                function (callback) {
                                    setTimeout(function () {
                                        console.log("wrote hum_off " + hum_off + "");
                                        sp.write("hum_off " + hum_off + "\r");
                                        callback(null);
                                    }, 500);
                                },
                                function (callback) {
                                    setTimeout(function () {
                                        console.log("wrote backup all");
                                        sp.write("backup all\r");
                                        callback(null);
                                    }, 500);
                                },
                                function (callback) {
                                    setTimeout(function () {
                                        console.log("wrote restore defaults");
                                        sp.write("restore defaults\r");
                                        callback(null);
                                    }, 500);
                                }
                            ],
                            function (err) {

                            });
                    }

                    if (lineCount == 100) {
                        setTimeout(function () {
                            sp.close();
                            console.log("serial port closed.");
                            callback(null);
                        }, 5000);
                    }
                });
            });
        }
    },function(err){
        res.json(allPorts);
    });

});



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