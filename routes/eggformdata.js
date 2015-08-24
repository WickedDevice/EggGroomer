var express = require('express');
var router = express.Router();
var waterfall = require('async-waterfall');
var async = require('async');
var Spreadsheet = require('edit-google-spreadsheet');
var config = require('../../config');

router.get('/', function(req, res, next) {

    // get egg serial number from query string
    var egg_serial_number = req.param("egg_serial_number")
    if(egg_serial_number.slice(0, 3) == "egg"){
        egg_serial_number = egg_serial_number.slice(3);
    }

    var egg_obj = {};

    waterfall(
        [
            function(callback){
                Spreadsheet.load({
                        debug: true,
                        spreadsheetId: config["google-spreadsheetId"],
                        worksheetId: config["google-worksheetId"],
                        oauth2: config["google-oauth2"]
                    },
                    function sheetReady(err, spreadsheet) {
                        if(err) throw err;

                        spreadsheet.receive(function(err, rows, info) {
                            if(err) throw err;

                            //console.log("Found rows:", rows);
                            var first_row = rows[1];
                            var num_fields = Object.keys(first_row).length

                            var field_map = {};
                            for(field in first_row){
                                field_map[first_row[field]] = field;
                                egg_obj[first_row[field]] = []; // an array of length 1 eventually is the hope
                            }

                            var num_rows = Object.keys(rows).length;
                            for(var i = 2; i <= num_rows; i++){
                                if(rows[i][field_map["SHT25 / Egg Serial Number"]] == egg_serial_number){
                                    for(field in rows[i]){
                                        egg_obj[first_row[field]].push(
                                            rows[i][field]
                                        );
                                    }
                                }
                            }

                            callback(null);
                        });
                    }
                );
            }
        ],
        function(err, result){
            console.log(egg_obj);
            res.json(egg_obj);
        }
    );

});

module.exports = router;