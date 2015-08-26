var express = require('express');
var router = express.Router();
var waterfall = require('async-waterfall');
var async = require('async');
var Spreadsheet = require('edit-google-spreadsheet');
var config = require('../../config');

var form_database = {};
var first_time = true;

function stripLeadingTickAndEgg(str){
    var ret = str;
    if(ret.length >= 1 && ret.slice(0,1) == "'"){
        ret = str.slice(1);
    }

    if(ret.length >= 3 && ret.slice(0,3) == "egg"){
        ret = str.slice(3);
    }

    return ret;
}

function loadDatabase(callback){
    Spreadsheet.load({
            debug: true,
            useCellTextValues: false, // false? seriously? yup.
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

                // create the inverse lookup mapping
                var field_map = {};
                for(field in first_row){
                    field_map[first_row[field]] = field;
                }

                // go through each row and add it to the database
                var num_rows = Object.keys(rows).length;

                for(var i = 2; i <= num_rows; i++) {

                    //if(i == 328){
                    //    console.log(rows[i]);
                    //}

                    var egg_serial_number = rows[i][field_map["SHT25 / Egg Serial Number"]];
                    // if egg_serial_number has a leading appostrophe, remove it.
                    if(!egg_serial_number){
                        egg_serial_number = "";
                    }

                    egg_serial_number = stripLeadingTickAndEgg(egg_serial_number);

                    for(var field in rows[i]){
                        if(!form_database[egg_serial_number]){
                            // need a new entry, seed it with empty arrays
                            form_database[egg_serial_number] = {};
                            for(var ffield in first_row){
                                form_database[egg_serial_number][first_row[ffield]] = [];
                            }
                        }

                        // add the field data to it, now that it must exist
                        if(first_row[field]) {
                            form_database[egg_serial_number][first_row[field]].push(
                                stripLeadingTickAndEgg(rows[i][field])
                            );
                        }
                    }
                }

                callback(null);
            });
        }
    );
}

router.get('/', function(req, res, next) {

    // get egg serial number from query string
    var egg_serial_number = req.query.egg_serial_number;
    if(egg_serial_number && egg_serial_number.slice(0, 3) == "egg"){
        egg_serial_number = egg_serial_number.slice(3);
    }

    var egg_obj = {};

    waterfall(
        [
            function(callback){
                if(first_time) {
                    loadDatabase(callback);
                    first_time = false;
                }
                else{
                    callback(null);
                }
            },
            function(callback){
                if(egg_serial_number){
                    if(form_database[egg_serial_number]){
                        // no need to deep copy it, since we're read only here
                        egg_obj = form_database[egg_serial_number];
                    }
                }
                callback(null);
            }
        ],
        function(err, result){
            console.log(egg_obj);
            res.json(egg_obj);
        }
    );

});

module.exports = router;