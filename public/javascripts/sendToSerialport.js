/**
 * Created by dirk on 8/26/2015.
 * sendToSerialPort.js
 * Sends a text array of commands to the serial port
 * sequentially.
 * sp - serial port
 * cmdArray - text array of commands
 */
var waterfall = require('async-waterfall');
var async = require('async');

(function(){
    var sendToSerialPort = {};
    sendToSerialPort.send = function (sp, cmdArray){
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


}());