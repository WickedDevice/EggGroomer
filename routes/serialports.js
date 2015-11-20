var express = require('express');
var router = express.Router();
var async = require('async');
var serialPort = require("serialport");
var SerialPort = require("serialport").SerialPort

var guardListPorts = false;
var allPorts = [];
var dataRecordBySerialNumber = [];

var openHandles = [];
var currentCalibrationValues = {};
var currentNetworkValues = {};

function isNumeric(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
}

function stripTrailingBarAndTrim(str){
    return str.substring(0, str.lastIndexOf("|")).trim();
}

function removeLeadingBarAndTrim(str){
    var tmp = str.trim();
    if(tmp[0] == '|' && tmp.length > 1){
        tmp = tmp.substring(1);
    }
    return tmp.trim();
}

function backedUpOrNot(str){
    if(str.trim() == ""){
        return "Backed Up";
    }
    else{
        return "NOT Backed Up";
    }
}

var removeSerialPortHandleByPath = function(path){
    var indexToRemove = -1;
    for(var i = 0; i < openHandles.length; i++){
        if(openHandles[i].path == path){
            indexToRemove = i;
            break;
        }
    }

    if (indexToRemove > -1) {
        openHandles.splice(indexToRemove, 1);
    }
}

// sp is the serial port to target
// numLinesToWaitForBeforeClosing can be null to not close the port
// subsequentProcessingFunction can be null if there's nothing to do on each line received
// functionToCallAfterAllCommandsSent can be null if there's nothing to do right after sending all the commands
function sendCommandList(sp, functionToCallOnSpOpen, numLinesToWaitForInitially, commandList, timeBetweenCommands,
                         substringToWaitForBeforeClosing, timeToWaitBeforeClosing, functionToCallAfterClosing,
                         subsequentProcessingFunction, functionToCallAfterAllCommandsSent, subsequentProcessingFunctionArgs){

    var commandFuncs = [];
    commandList.forEach( function(cmd){
        commandFuncs.push( function(callback){
                setTimeout(function(){
                    callback();
                    if(sp.isOpen()){
                        console.log("Issuing command '" + cmd + "'");
                        sp.write(cmd + "\r");
                        sp.drain();
                        sp.flush();
                    }
                    else{
                        console.log("Port was closed, preventing command '" + cmd + "' from being issued");
                    }
                }, timeBetweenCommands);
            }
        );
    });

    var lineCount = 0;
    var allCommandsSent = false;

    commandFuncs.push( function(callback){
        allCommandsSent = true;
    });

    sp.on("open", function () {
        console.log('open');
        openHandles.push(sp);

        if(functionToCallOnSpOpen !== null){
            functionToCallOnSpOpen(sp);
        }

        var alreadySetTimeout = false;

        sp.on('data', function (data) {
            console.log(sp.path+ ' line ' + lineCount + ': ' + data);
            lineCount++;

            var start_sending_now = false;
            if(data.indexOf("OPERATIONAL mode automatically begins after 12 secs of no input.") >= 0){
                start_sending_now = true;
            }

            if ((lineCount == numLinesToWaitForInitially) || start_sending_now) {
                async.series(
                    commandFuncs,
                    function(err){
                        console.log("All commands sent!")
                        if(functionToCallAfterAllCommandsSent){
                            functionToCallAfterAllCommandsSent(err);
                        }

                        if(err) return next(err);
                    });
            }


            if(!alreadySetTimeout && (data.indexOf(substringToWaitForBeforeClosing) != -1)){
                alreadySetTimeout = true;
                setTimeout(function(){
                    console.log("serial port ready to be closed.");
                    if(functionToCallAfterClosing){
                        functionToCallAfterClosing(null);
                    }
                }, timeToWaitBeforeClosing);
            }


            if(subsequentProcessingFunction){
                var args = subsequentProcessingFunctionArgs == null ? {} : subsequentProcessingFunctionArgs;
                args["data"] = data;
                subsequentProcessingFunction(args);
            }

        });
    });
}

var fieldStringSplitMap = [
    {"    MAC Address: ": ["CC3000 MAC address", null]},
    {" MQTT Password backed up?": ["Open Sensors .io password", backedUpOrNot]},
    {"    CO Sensitivity [nA/ppm]: ": ["CO Sensitivity", null]},
    {"    CO Offset [V]: ": ["CO Sensor Zero Value", null]},
    {"    NO2 Sensitivity [nA/ppm]: ": ["NO2 Sensitivity", null]},
    {"    NO2 Offset [V]: ": ["NO2 Sensor Zero Value", null]},
    {"    O3 Sensitivity [nA/ppm]: ": ["O3 Sensitivity", null]},
    {"    O3 Offset [V]: ": ["O3 Sensor Zero Value", null]},
    {"    SO2 Sensitivity [nA/ppm]: ": ["SO2 Sensitivity", null]},
    {"    SO2 Offset [V]: ": ["SO2 Sensor Zero Value", null]},
    {"    Temperature Reporting Offset [degC]: ": ["Temperature Offset", null]},
    {"    Humidity Reporting Offset [%]: ": ["Humidity Offset", null]},
    {"    MQTT Client ID: ": ["OpenSensors Username", null]}
];

function getSerialNumberForPort(portName){
    for(var i = 0; i < allPorts.length; i++){
        if(allPorts[i].comName == portName){
            return allPorts[i]["serialNumber"];
        }
    }
    return null;
}

var portToFirmwareVersionMap = {};
var portToSensorTypeMap = {};
function setFirmwareVersionForPort(portName, firmwareVersion){
    portToFirmwareVersionMap[portName] = firmwareVersion;
    return;
}

function setSensorTypeForPort(portName, sensorType){
    portToSensorTypeMap[portName] = sensorType;
    return;
}

function getFirmwareVersionForPort(portName){
    return portToFirmwareVersionMap[portName];
}

function getSensorTypeForPort(portName){
    return portToSensorTypeMap[portName];
}

var openPortsDataLineProcessing = function(args){ // what to do whenever you get a data line [collect the table data into global object]
    var data = args["data"];
    var obj = args["obj"];
    var portName = args["portName"];
    var parts = data.trim().split("Egg Serial Number: ");
    var serialNumber = getSerialNumberForPort(portName);
    if(parts.length == 2){
        serialNumber = parts[1];
        if(obj) {
            obj.serialNumber = serialNumber;
            obj.sensorType = getSensorTypeForPort(portName);
            allPorts.push(obj);
        }
        dataRecordBySerialNumber[serialNumber] = {};
        dataRecordBySerialNumber[serialNumber]["Shipped Firmware Version"] = [getFirmwareVersionForPort(portName)];
        dataRecordBySerialNumber[serialNumber]["Sensor Type"] = [getSensorTypeForPort(portName)];
        dataRecordBySerialNumber[serialNumber]["comName"] = portName;
    }

    var flag = false;

    if(!flag) {
        parts = data.split("   Firmware Version ");
        if (parts.length > 1) {
            var firmwareVersion = stripTrailingBarAndTrim(parts[1]);
            setFirmwareVersionForPort(portName, firmwareVersion)
            flag = true;
        }
    }

    if(!flag){
        parts = data.split("Sensor Suite");
        if(parts.length > 1) {
            var sensorType = removeLeadingBarAndTrim(parts[0]);
            setSensorTypeForPort(portName, sensorType);
            flag = true;
        }
    }

    if(!flag){
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
                        console.log("AAAAAAAAAAAAAAAAAAAAAAAARGGGHGHHH!");
                    }
                    break;
                }
            }

            if(found){
                break;
            }
        }
    }
}

function openSerialPort(portName, obj, parentCallback){
    var sp = new SerialPort(portName, {
        baudrate: 115200,
        parser: serialPort.parsers.readline("\n")
    });

    var lineCount = 0;
    var serialNumber = null;
    var firmwareVersion = null;
    async.series([
        function(callback) {
            sendCommandList(
                sp, // the port to target
                null, // on serial port open [null because we don't need to hang on to the handles]
                22, // number of lines before starting to issue commands
                ["aqe"], // the list of commands
                1000, // how long to wait between sending each command
                '@===', // close if you receive a line that contains this string
                0, // the time to wait after that many lines before closing the port
                callback, // the function to call after closing the port  [return from http request after closing the port]
                openPortsDataLineProcessing,
                null, // function to call after all commands have been sent [null because we're going to close the port after]
                {"obj": obj, "portName": portName}
            )
        }
    ],
    function(err){
        parentCallback(err);
    });

}

router.get('/data/:serialNumber', function(req, res, next) {
    res.json(dataRecordBySerialNumber[req.params["serialNumber"]]);
});

function commitValuesToSerialPort(objData, portName, parentCallback){
    var sp = new SerialPort(portName, {
        baudrate: 115200,
        parser: serialPort.parsers.readline("\n")
    });

    async.series([
        function(callback) {
            if(objData["no2-offset"].trim() != ""){
                sendCommandList(
                    sp, // the port to target
                    null, // on serial port open [null because we don't need to hang on to the handles]
                    22, // number of lines before starting to issue commands
                    [
                        "aqe",
                        "no2_sen " + Math.abs(parseFloat(objData["no2-sensitivity"])),
                        "no2_off " + objData["no2-offset"].trim(),
                        "co_sen " + Math.abs(parseFloat(objData["co-sensitivity"])),
                        "co_off " + objData["co-offset"].trim(),
                        "temp_off " + objData["temperature-offset"].trim(),
                        "hum_off " + objData["humidity-offset"].trim(),
                        "mqttpwd " + objData["mqtt-password"].trim(),
                        "backup all",
                        "restore defaults"
                    ], // the list of commands
                    1000, // how long to wait between sending each command
                    'Info: Erasing mirrored config...OK.', // close if you receive a line that contains this string
                    500, // the time to wait after that many lines before closing the port
                    callback, // the function to call after closing the port
                    null, // what to do whenever you get a data line, [null because we aren't consuming the Egg output in this function]
                    null // function to call after all commands have been sent [null because we are just going to close the port when done]
                );
            }
            else if(objData["so2-offset"].trim() != ""){
                sendCommandList(
                    sp, // the port to target
                    null, // on serial port open [null because we don't need to hang on to the handles]
                    22, // number of lines before starting to issue commands
                    [
                        "aqe",
                        "so2_sen " + Math.abs(parseFloat(objData["so2-sensitivity"])),
                        "so2_off " + objData["so2-offset"].trim(),
                        "o3_sen " + Math.abs(parseFloat(objData["o3-sensitivity"])),
                        "o3_off " + objData["o3-offset"].trim(),
                        "temp_off " + objData["temperature-offset"].trim(),
                        "hum_off " + objData["humidity-offset"].trim(),
                        "mqttpwd " + objData["mqtt-password"].trim(),
                        "backup all",
                        "restore defaults"
                    ], // the list of commands
                    1000, // how long to wait between sending each command
                    'Info: Erasing mirrored config...OK.', // close if you receive a line that contains this string
                    500, // the time to wait after that many lines before closing the port
                    callback, // the function to call after closing the port
                    null, // what to do whenever you get a data line, [null because we aren't consuming the Egg output in this function]
                    null // function to call after all commands have been sent [null because we are just going to close the port when done]
                );
            }
            else{
                sendCommandList(
                    sp, // the port to target
                    null, // on serial port open [null because we don't need to hang on to the handles]
                    22, // number of lines before starting to issue commands
                    [
                        "aqe",
                        "temp_off " + objData["temperature-offset"].trim(),
                        "hum_off " + objData["humidity-offset"].trim(),
                        "mqttpwd " + objData["mqtt-password"].trim(),
                        "backup all",
                        "restore defaults"
                    ], // the list of commands
                    1000, // how long to wait between sending each command
                    'Info: Erasing mirrored config...OK.', // close if you receive a line that contains this string
                    500, // the time to wait after that many lines before closing the port
                    callback, // the function to call after closing the port
                    null, // what to do whenever you get a data line, [null because we aren't consuming the Egg output in this function]
                    null // function to call after all commands have been sent [null because we are just going to close the port when done]
                );
            }
        },
        function(callback) {
            disconnectAllOpenSerialPorts(callback);
        }
    ],
    function(err){
       parentCallback(err);
    });

}

var calibrationDataLineProcessing = function(args) { // what to do whenever you get a data line, [parse the csv lines and keep the latest values around in a global]
    var data = args["data"];
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

router.get('/startcalibration', function(req, res, next) {
    async.forEach(allPorts, function(port, callback) {
        var sp = new SerialPort(port.comName, {
            baudrate: 115200,
            parser: serialPort.parsers.readline("\n")
        });

        var commands = [];

        if(req.query.zero == "true"){
            commands = [
                "aqe",
                "init mac",
                "restore defaults",
                "opmode offline",
                "temp_off 0",
                "hum_off 0",
                "pm_off 0",
                "backup all",
                "exit"
            ];
        }
        else{
            commands = [
                "aqe",
                "opmode offline",
                "exit"
            ];
        }



        sendCommandList(
            sp, // the port to target
            null,
            22, // number of lines before starting to issue commands
            commands, // the list of commands
            1000, // how long to wait between sending each command
            null, // the number of lines to wait before closing the port [null because we aren't going to close the port at all here]
            null, // the time to wait after that many lines before closing the port [null because we aren't going to close the port at all here]
            null, // the function to call after closing the port [null because we aren't going to close the port at all here]
            calibrationDataLineProcessing,
            callback // function to call after all commands have been sent, [return from http response here because we aren't going to close the port here]
        );
    },
    function(err){
        // intentionally do not call disconnectAllOpenSerialPorts();
        res.json(allPorts);
    });
});

var wifiConnectDataLineProcessing = function(args) { // what to do whenever you get a data line, [parse the csv lines and keep the latest values around in a global]
    var data = args["data"];
    var serialNumber = args["serialNumber"];

    if(!currentNetworkValues[serialNumber]) {
        currentNetworkValues[serialNumber] = {};
    }

    if(!data){
        return;
    }

    data = data.trim();

    if(data.indexOf('Beginning Network Scan...') > -1){
        currentNetworkValues[serialNumber]["Status"] = "Scanning";
    }
    else if(data.indexOf('Network Scan found') > -1){
        currentNetworkValues[serialNumber]["Status"] = "Scan found " + data.slice("Info: Network Scan found ".length);
    }
    else if(data.indexOf('Found Access Point') > -1){
        var rssi = data.match('RSSI = ([0-9]+)');
        if(rssi) {
            currentNetworkValues[serialNumber]["Status"] = "Network found - RSSI " + rssi[1];
        }
        else{
            currentNetworkValues[serialNumber]["Status"] = "Network found - no RSSI";
        }
    }
    else if(data.indexOf('Connecting to Access Point with SSID') > -1){
        var ok = data.match(/OK\.$/);
        if(ok){
            currentNetworkValues[serialNumber]["Status"] = "Connected";
        }
        else{
            currentNetworkValues[serialNumber]["Status"] = "Connect Failed";
        }
    }
    else if(data.indexOf('Request DHCP...') > -1){
        var ok = data.match(/OK$/);
        if(ok){
            currentNetworkValues[serialNumber]["Status"] = "Got DHCP";
        }
        else{
            currentNetworkValues[serialNumber]["Status"] = "DHCP Failed";
        }
    }
    else if(data.indexOf('IP Addr:') > -1){
        currentNetworkValues[serialNumber]["Status"] = "IP: " +data.slice("Info: IP Addr: ".length);
    }
    else if(data.indexOf('MQTT Broker') > -1){
        if(data.indexOf('OK') > -1){
            currentNetworkValues[serialNumber]["Status"] = "Connected to MQTT";
        }
        else{
            currentNetworkValues[serialNumber]["Status"] = "MQTT Failed";
        }
    }
}

router.get('/startwificonnect', function(req, res, next) {
    async.forEach(allPorts, function(port, callback) {
            var serialNumber = port.serialNumber;

            var sp = new SerialPort(port.comName, {
                baudrate: 115200,
                parser: serialPort.parsers.readline("\n")
            });

            var commands = [
                "aqe",
                "opmode normal",
                "exit"
            ];

            sendCommandList(
                sp, // the port to target
                null,
                22, // number of lines before starting to issue commands
                commands, // the list of commands
                1000, // how long to wait between sending each command
                null, // the number of lines to wait before closing the port [null because we aren't going to close the port at all here]
                null, // the time to wait after that many lines before closing the port [null because we aren't going to close the port at all here]
                null, // the function to call after closing the port [null because we aren't going to close the port at all here]
                wifiConnectDataLineProcessing,
                callback // function to call after all commands have been sent, [return from http response here because we aren't going to close the port here]
            );
        },
        function(err){
            // intentionally do not call disconnectAllOpenSerialPorts();
            res.json(allPorts);
        });
});

var disconnectAllOpenSerialPorts = function(callbackOnAllClosed){
    async.forEach(openHandles, function(sp, callback){
            if(sp && sp.isOpen()) {
                sp.close(function () {
                    console.log("close");
                    callback(null);
                });
            }
        },
        function(err) {
            openHandles = [];
            if(callbackOnAllClosed) {
                callbackOnAllClosed();
            }
        });
}

router.get('/disconnectAll', function(req, res, next) {
    disconnectAllOpenSerialPorts(function(){
        res.json({status: "OK"});
    })
});

// this will get polled periodically to update the front end
router.get("/currentcalibrationdata", function(req, res, next){
    res.json(currentCalibrationValues);
});

// this will get polled periodically to update the front end
router.get("/currentwifistatus", function(req, res, next){
    res.json(currentNetworkValues);
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
                22, // number of lines before starting to issue commands
                [
                    "aqe",
                    "temp_off " + temp_off,
                    "hum_off " + hum_off,
                    "backup all",
                    "restore defaults"
                ], // the list of commands
                1000, // how long to wait between sending each command
                'Info: Erasing mirrored config...OK.', // close if you receive a line that contains this string
                500, // the time to wait after that many lines before closing the port
                callback, // the function to call after closing the port
                null, // what to do whenever you get a data line, [null because we are not processing Egg output]
                null, // function to call after all commands have been sent [null because we are going to callback when we close the port]
                {"serialNumber" : serialNumber}
            );
        }
    },function(err){
        disconnectAllOpenSerialPorts();
        res.json(allPorts);
    });

});

router.post('/applynetworksettings', function(req, res, next) {

    //TODO: I have no idea why i have to jump through hoops here in order to parse the posted object
    var obj = req.body;
    for(var key in obj){
        obj = JSON.parse(key);
        break;
    }

    console.log(obj);

    async.forEach(allPorts, function(port, callback) {
        var serialNumber = port.serialNumber;

        if(!serialNumber){ // no data for this port was sent
            callback(null);
        }
        else {
            var sp = new SerialPort(port.comName, {
                baudrate: 115200,
                parser: serialPort.parsers.readline("\n")
            });

            var ssid = obj["ssid"];
            var password = obj["password"];

            sendCommandList(
                sp, // the port to target
                null, // on serial port open, [null because we are going to the close the port before we're done]
                18, // number of lines before starting to issue commands
                [
                    "aqe",
                    "restore defaults",
                    "ssid " + ssid,
                    "pwd " + password,
                    "exit"
                ], // the list of commands
                1000, // how long to wait between sending each command
                '-~=* In OPERATIONAL Mode *=~-', // close if you receive a line that contains this string
                500, // the time to wait after that many lines before closing the port
                callback, // the function to call after closing the port
                null, // what to do whenever you get a data line, [null because we are not processing Egg output]
                null, // function to call after all commands have been sent [null because we are going to callback when we close the port]
                {"serialNumber" : serialNumber}
            );
        }
    },function(err){
        disconnectAllOpenSerialPorts();
        res.json(allPorts);
    });

});

router.post('/clearwifisettings', function(req, res, next) {

    async.series([
        function(callback) {
            disconnectAllOpenSerialPorts(callback);
        },
        function(parentCallback) {
            async.forEach(allPorts, function (port, callback) {
                var serialNumber = port.serialNumber;

                if (!serialNumber) { // no data for this port was sent
                    callback(null);
                }
                else {
                    var sp = new SerialPort(port.comName, {
                        baudrate: 115200,
                        parser: serialPort.parsers.readline("\n")
                    });

                    sendCommandList(
                        sp, // the port to target
                        null, // on serial port open, [null because we are going to the close the port before we're done]
                        22, // number of lines before starting to issue commands
                        [
                            "aqe",
                            "restore defaults",
                        ], // the list of commands
                        1000, // how long to wait between sending each command
                        'Info: Erasing mirrored config...OK.', // close if you receive a line that contains this string
                        500, // the time to wait after that many lines before closing the port
                        callback, // the function to call after closing the port
                        null, // what to do whenever you get a data line, [null because we are not processing Egg output]
                        null, // function to call after all commands have been sent [null because we are going to callback when we close the port]
                        {"serialNumber": serialNumber}
                    );
                }
            }, function (err) {
                disconnectAllOpenSerialPorts();
                parentCallback();
            });
        }
    ],
    function(err){
        res.json(allPorts);
    });
});


router.post('/commit/:serialNumber', function(req, res, next) {
    var found_it = false;

    for(var entry in allPorts){
        if(allPorts[entry]["serialNumber"] == req.params["serialNumber"]) {
            found_it = true;
            console.log(req.body);

            async.series([
                function (callback) {
                    commitValuesToSerialPort(req.body, allPorts[entry].comName, callback);
                }
            ],
            function(err) {
                if (err) return next(err);
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

    for(var i = 0; i < openHandles.length; ii++){
        if(openHandles[i].isOpen()){
            removeSerialPortHandleByPath(openHandles[i].path);
            openHandles[i].close();
        }
    }
    openHandles = [];

    var listedPorts = [];

    async.series(
        [
            function(callback){
                serialPort.list(function (err, ports) {
                    listedPorts = ports;
                    callback();
                });
            },
            function(callback){
                async.forEach(listedPorts, function(port, subcallback){
                        var obj = {};
                        obj.comName = port.comName;
                        obj.pnpId = port.pnpId;
                        obj.manufacturer = port.manufacturer;
                        if(obj.manufacturer == "FTDI") {
                            openSerialPort(port.comName, obj, subcallback)
                        }
                        else{
                            console.log("Encountered non-FTDI serial port");
                            subcallback();
                        }
                    },
                    function(err) {
                        callback(err);
                    });
            }
        ],
        function(err){
            disconnectAllOpenSerialPorts();
            guardListPorts = false;
            if(err) return next(err);
            res.json(allPorts);
        }
    );
});

module.exports = router;