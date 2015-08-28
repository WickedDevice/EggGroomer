var express = require('express');
var router = express.Router();
var waterfall = require('async-waterfall');
var async = require('async');
var serialPort = require("serialport");
var SerialPort = require("serialport").SerialPort

var guardListPorts = false;
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

// sp is the serial port to target
// numLinesToWaitForBeforeClosing can be null to not close the port
// subsequentProcessingFunction can be null if there's nothing to do on each line received
// functionToCallAfterAllCommandsSent can be null if there's nothing to do right after sending all the commands
function sendCommandList(sp, functionToCallOnSpOpen, numLinesToWaitForInitially, commandList, timeBetweenCommands,
                         numLinesToWaitForBeforeClosing, timeToWaitBeforeClosing, functionToCallAfterClosing,
                         subsequentProcessingFunction, functionToCallAfterAllCommandsSent){

    var commandFuncs = [];
    commandList.forEach( function(cmd){
        commandFuncs.push( function(callback){
                setTimeout(function(){
                    sp.write(cmd + "\r");
                    callback(null);
                }, timeBetweenCommands);
            }
        );
    });

    var lineCount = 0;

    sp.on("open", function () {
        console.log('open');

        if(functionToCallOnSpOpen !== null){
            functionToCallOnSpOpen(sp);
        }

        sp.on('data', function (data) {
            console.log('line ' + lineCount + ': ' + data);
            lineCount++;
            if (lineCount == numLinesToWaitForInitially) {
                waterfall(
                    commandFuncs,
                    function(err){
                        if(functionToCallAfterAllCommandsSent !== null){
                            functionToCallAfterAllCommandsSent(err);
                        }
                    });
            }

            if(lineCount !== null && lineCount == numLinesToWaitForBeforeClosing){
                setTimeout(function(){
                    sp.close();
                    console.log("serial port closed.");
                    if(functionToCallAfterClosing !== null){
                        functionToCallAfterClosing(null);
                    }
                }, timeToWaitBeforeClosing);
            }

            if(subsequentProcessingFunction !== null){
                subsequentProcessingFunction(data);
            }

        });
    });
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

    sendCommandList(
         sp, // the port to target
         null, // on serial port open [null because we don't need to hang on to the handles]
         21, // number of lines before starting to issue commands
         ["aqe"], // the list of commands
         0, // how long to wait between sending each command
         80, // the number of lines to wait before closing the port
         0, // the time to wait after that many lines before closing the port
         callback, // the function to call after closing the port  [return from http request after closing the port]
         function(data){ // what to do whenever you get a data line [collect the table data into global object]
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

                             // this whole guard is to stop the application from crashing
                             // because of hitting refresh while the page is still loading
                             // and server processing is still ongoing, causing global variable mayhem
                             if( serialNumber
                                 && entry
                                 && key
                                 && dataRecordBySerialNumber
                                 && dataRecordBySerialNumber[serialNumber]
                                 && fieldStringSplitMap
                                 && fieldStringSplitMap[entry]
                                 && fieldStringSplitMap[entry][key]
                                 && fieldStringSplitMap[entry][key][0])
                             {
                                 dataRecordBySerialNumber[serialNumber][fieldStringSplitMap[entry][key][0]] = [arg];

                             }
                             else{
                                 // well that wasn't good...
                                 //throw new Error("Please restart the app and be more patient while it initializes.");
                             }
                             break;
                         }
                     }

                     if(found){
                         break;
                     }
                 }
             }
         },
         null // function to call after all commands have been sent [null because we're going to close the port after]
    );
}

router.get('/data/:serialNumber', function(req, res, next) {
    res.json(dataRecordBySerialNumber[req.params["serialNumber"]]);
});

function commitValuesToSerialPort(objData, portName, callback){
    var sp = new SerialPort(portName, {
        baudrate: 115200,
        parser: serialPort.parsers.readline("\n")
    });

    sendCommandList(
        sp, // the port to target
        null, // on serial port open [null because we don't need to hang on to the handles]
        21, // number of lines before starting to issue commands
        [
            "aqe",
            "no2_sen " + Math.abs(parseFloat(objData["no2-sensitivity"])),
            "no2_off " + objData["no2-offset"].trim(),
            "co_sen " + Math.abs(parseFloat(objData["co-sensitivity"])),
            "co_off " + objData["co-offset"].trim(),
            "mqttpwd " + objData["mqtt-password"].trim(),
            "backup all",
            "restore defaults"
        ], // the list of commands
        500, // how long to wait between sending each command
        100, // the number of lines to wait before closing the port
        5000, // the time to wait after that many lines before closing the port
        callback, // the function to call after closing the port
        null, // what to do whenever you get a data line, [null because we aren't consuming the Egg output in this function]
        null // function to call after all commands have been sent [null because we are just going to close the port when done]
    );
}

router.get('/startcalibration', function(req, res, next) {
    async.forEach(allPorts, function(port, callback) {
        var sp = new SerialPort(port.comName, {
            baudrate: 115200,
            parser: serialPort.parsers.readline("\n")
        });

        sendCommandList(
            sp, // the port to target
            function(sp){  // on serial port open, collect the handles so we can close them later
                openHandles.push(sp);
            },
            21, // number of lines before starting to issue commands
            [
                "aqe",
                "opmode offline",
                "temp_off 0",
                "hum_off 0",
                "backup all",
                "exit"
            ], // the list of commands
            500, // how long to wait between sending each command
            null, // the number of lines to wait before closing the port [null because we aren't going to close the port at all here]
            null, // the time to wait after that many lines before closing the port [null because we aren't going to close the port at all here]
            null, // the function to call after closing the port [null because we aren't going to close the port at all here]
            function(data) { // what to do whenever you get a data line, [parse the csv lines and keep the latest values around in a global]
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
            },
            callback // function to call after all commands have been sent, [return from http response here because we aren't going to close the port here]
        );
    },
    function(err){
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

    //TODO: I have no idea why i have to jump through hoops here in order to parse the posted object
    var obj = req.body;
    for(var key in obj){
        obj = JSON.parse(key);
        break;
    }

    console.log(obj);

    async.forEach(allPorts, function(port, callback) {
        var serialNumber = port.serialNumber;

        if(!obj[serialNumber]){ // no data for this port was sent
            callback(null);
        }
        else {
            var sp = new SerialPort(port.comName, {
                baudrate: 115200,
                parser: serialPort.parsers.readline("\n")
            });

            var temp_off = obj[serialNumber]["temp_off"];
            var hum_off = obj[serialNumber]["hum_off"];

            sendCommandList(
                sp, // the port to target
                null, // on serial port open, [null because we are going to the close the port before we're done]
                21, // number of lines before starting to issue commands
                [
                    "aqe",
                    "temp_off " + temp_off,
                    "hum_off " + hum_off,
                    "backup all",
                    "restore defaults"
                ], // the list of commands
                500, // how long to wait between sending each command
                100, // the number of lines to wait before closing the port
                5000, // the time to wait after that many lines before closing the port
                callback, // the function to call after closing the port
                null, // what to do whenever you get a data line, [null because we are not processing Egg output]
                null // function to call after all commands have been sent [null because we are going to callback when we close the port]
            );
        }
    },function(err){
        res.json(allPorts);
    });

});



router.post('/commit/:serialNumber', function(req, res, next) {
    var found_it = false;

    for(var entry in allPorts){
        if(allPorts[entry]["serialNumber"] == req.params["serialNumber"]) {
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
    if(guardListPorts){
        res.json({"status": "error", "code":"503", "message": "wait, we're busy right now."});
        return;
    }

    guardListPorts = true;
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
            guardListPorts = false;
        }
    );
});

module.exports = router;