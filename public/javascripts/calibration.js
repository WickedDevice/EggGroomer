var calibration_in_progress = false;
var calibration_started_at_some_point = false;

var calibrationPoisonPill;

function doCalibrationPoll(){
    $.get('/serialports/currentcalibrationdata', function(data) {
        for(var key in data){ // keys are Serial Numbers here
            // if the table doesn't already have a row for this key, create one
            if($("tr#" + key).length == 0){
                $('#calTable tr:last').after(
                  '<tr id="' + key + '"><td>' + key + '</td><td class="Temperature"></td><td class="Humidity"></td>'
                );
            }
            values = data[key];
            for(var value_type in values){ // value_type is Temperature or Humidity
                value = values[value_type]; // this is a number
                $("#" + key + " td." + value_type).text(value);
            }
        }

        calibrationPoisonPill = setTimeout(doCalibrationPoll, 5000);
    });
}

function cancelCalibrationPoll(){
    if(calibrationPoisonPill) {
        clearTimeout(calibrationPoisonPill);
    }
}

function startDataCapture(zeroOffsets){
    if(!calibration_in_progress){
        calibration_in_progress = true;
        calibration_started_at_some_point = true;
        $("#feedback").css("background-color", "yellow");
        $("#feedback").css("color", "black");
        $("#feedback").text("Starting Calibration...");

        if(zeroOffsets){
            zeroOffsets = "true";
        }
        else{
            zeroOffsets = "false";
        }

        $.getJSON('/serialports/startcalibration?zero=' + zeroOffsets, function( data ) {
            $("#feedback").css("background-color", "green");
            $("#feedback").css("color", "white");
            $("#feedback").text("Calibration In Progress...");

            // kick off a periodic timer to update the table occationally
            doCalibrationPoll();
        });
    }
}

$(function(){
    $("#start-acquisition-button").click(function(){
        startDataCapture(false);
    });

    $("#start-calibration-button").click(function(){
        startDataCapture(true);
    });

    $("#stop-calibration-button").click(
        function(){
            calibration_in_progress = false;
            $("#feedback").css("background-color", "yellow");
            $("#feedback").css("color", "black");
            $("#feedback").text("Stopping Calibration...");

            $.getJSON('/serialports/disconnectAll', function( data ) {
                $("#feedback").css("background-color", "green");
                $("#feedback").css("color", "white");
                $("#feedback").text("Calibration Stopped...");

                cancelCalibrationPoll();
            });
        }
    );

    $("#apply-calibration-button").click(function(){
        if(!calibration_in_progress && calibration_started_at_some_point){
            // compose the object we are going to send
            var objs = {};
            $("table#calTable tr").each(function(index){
                var obj = {};
                if($(this).attr('id') && $(this).attr('id').slice(0, 3) == "egg"){
                    var serialNumber = $(this).attr('id');
                    var temperature = $("tr#" + serialNumber +  " td.Temperature").text();
                    var humidity = $("tr#" + serialNumber +  " td.Humidity").text();
                    objs[serialNumber] = {};
                    objs[serialNumber].temp_off = temperature - parseFloat($("input#actual-temperature").val());
                    objs[serialNumber].hum_off = humidity - parseFloat($("input#actual-humidity").val());
                }
            });

            $("#feedback").css("background-color", "yellow");
            $("#feedback").css("color", "black");
            $("#feedback").text("Applying Calibrations...");

            $.post("/serialports/applycalibrations",
                JSON.stringify(objs),
                function(){
                    $("#feedback").css("background-color", "green");
                    $("#feedback").css("color", "white");
                    $("#feedback").text("Applying Calibrations... Complete");
                }
            );
        }
    });
});