var calibration_in_progress = false;
var calibration_started_at_some_point = false;

var poisonPill;

function doPoll(){
    $.get('/serialports/currentcalibrationdata', function(data) {
        for(var key in data){ // keys are Serial Numbers here
            // if the table doesn't already have a row for this key, create one
            if(!$("tr#" + key)){
                $('#calTable tr:last').after(
                  '<tr id="' + key + '"><td>' + key + '</td><td class="Temperature"></td><td class="Humidity"></td>'
                );
            }
            values = data[key];
            for(var value_type in values){ // value_type is Temperature or Humidity
                value = values[value_type]; // this is a number
                $("#" + key + "." + value_type).text(value);
            }
        }

        poisonPill = setTimeout(doPoll, 5000);
    });
}

function cancelPoll(){
    if(poisonPill) {
        clearTimeout(poisonPill);
    }
}

$(function(){
    $("#start-calibration-button").click(function(){
        if(!calibration_in_progress){
            calibration_in_progress = true;
            calibration_started_at_some_point = true;
            $("#feedback").css("background-color", "yellow");
            $("#feedback").css("color", "black");
            $("#feedback").text("Starting Calibration...");

            $.getJSON('/serialports/startcalibration', function( data ) {
                $("#feedback").css("background-color", "green");
                $("#feedback").css("color", "white");
                $("#feedback").text("Calibration In Progress...");

                // kick off a periodic timer to update the table occationally
                doPoll();
            });
        }
    });

    $("#stop-calibration-button").click(function(){
        if(calibration_in_progress){
            calibration_in_progress = false;
            $("#feedback").css("background-color", "yellow");
            $("#feedback").css("color", "black");
            $("#feedback").text("Stopping Calibration...");

            $.getJSON('/serialports/stopcalibration', function( data ) {
                $("#feedback").css("background-color", "green");
                $("#feedback").css("color", "white");
                $("#feedback").text("Calibration Stopped...");

                cancelPoll();
            });
        }
    });

    $("#apply-calibration-button").click(function(){
        if(!calibration_in_progress && calibration_started_at_some_point){

        }
    });
});