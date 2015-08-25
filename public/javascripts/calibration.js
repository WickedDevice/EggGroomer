var calibration_in_progress = false;
var calibration_started_at_some_point = false;

var poisonPill;

function doPoll(){
    $.post('/serialports/currentcalibrationdata', function(data) {
        // render the response object

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