var express = require('express');
var router = express.Router();
var waterfall = require('async-waterfall');
var async = require('async');

router.get('/', function(req, res, next) {
    var serialPort = require("serialport");
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
                            allPorts.push(obj);
                        }
                        callback();
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