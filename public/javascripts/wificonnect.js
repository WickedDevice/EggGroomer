var something_in_progress = false;
var wifi_testing_in_progress = false;

var wifiPoisonPill;

function doWiFiPoll(){
    $.get('/serialports/currentwifistatus', function(data) {
        for(var key in data){ // keys are Serial Numbers here
            // if the table doesn't already have a row for this key, create one
            if($("tr#" + key).length == 0){
                $('#network-table tr:last').after(
                  '<tr id="' + key + '"><td>' + key + '</td><td class="Status"></td>'
                );
            }
            values = data[key];
            for(var value_type in values){ // value_type is Status
                value = values[value_type]; // this is a string
                $("#" + key + " td." + value_type).text(value);
            }
        }

        wifiPoisonPill = setTimeout(doWiFiPoll, 5000);
    });
}

function cancelWiFiPoll(){
    if(wifiPoisonPill) {
        clearTimeout(wifiPoisonPill);
    }
}

$(function(){
    $("#start-wificonnect-button").click(function(){
        if(!something_in_progress && !wifi_testing_in_progress){
            something_in_progress = true;
            wifi_testing_in_progress = true;
            $("#feedback").css("background-color", "yellow");
            $("#feedback").css("color", "black");
            $("#feedback").text("Starting Wi-Fi Testing...");

            $.getJSON('/serialports/startwificonnect', function( data ) {
                $("#feedback").css("background-color", "green");
                $("#feedback").css("color", "white");
                $("#feedback").text("Wi-Fi Testing In Progress...");

                // kick off a periodic timer to update the table occationally
                doWiFiPoll();
                something_in_progress = false;
            });
        }
    });

    $("#stop-wificonnect-button").click(function(){
        if(!something_in_progress && wifi_testing_in_progress){
            something_in_progress = true;
            $("#feedback").css("background-color", "yellow");
            $("#feedback").css("color", "black");
            $("#feedback").text("Stopping Wi-Fi Testing...");

            $.getJSON('/serialports/disconnectAll', function( data ) {
                $("#feedback").css("background-color", "green");
                $("#feedback").css("color", "white");
                $("#feedback").text("Wi-Fi Testing Stopped...");
            });

            cancelWiFiPoll();
            something_in_progress = false;
            wifi_testing_in_progress = false;
        }
    });

    $("#clear-settings-button").click(function(){
        if(!something_in_progress && !wifi_testing_in_progress){
            something_in_progress = true;
            $("#feedback").css("background-color", "yellow");
            $("#feedback").css("color", "black");
            $("#feedback").text("Clearing Wi-Fi Settings...");

            $.post("/serialports/clearwifisettings",
                function(){
                    $("#feedback").css("background-color", "green");
                    $("#feedback").css("color", "white");
                    $("#feedback").text("Clearing Wi-Fi Settings... Complete");
                    something_in_progress = false;
                }
            );
        }
    });

    $("#apply-wificonnect-button").click(function(){
        if(!something_in_progress && !wifi_testing_in_progress){
            something_in_progress = true;
            $("#feedback").css("background-color", "yellow");
            $("#feedback").css("color", "black");
            $("#feedback").text("Applying Network Settings...");

            var objs = {
                "ssid": $("#wifi-ssid").val(),
                "password": $("#wifi-password").val()
            }

            $.post("/serialports/applynetworksettings",
                JSON.stringify(objs),
                function(){
                    $("#feedback").css("background-color", "green");
                    $("#feedback").css("color", "white");
                    $("#feedback").text("Applying Network Settings... Complete");
                    something_in_progress = false;
                }
            );
        }
    });
});