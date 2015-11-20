var attachedEggs = [];

function listPorts(){
    attachedEggs = [];

    $("#feedback").css("background-color", "yellow");
    $("#feedback").css("color", "black");
    $("#feedback").text("Listing Serial Ports...");
    $("#wait-for-serial-ports").show();
    $("#wait-for-serial-ports").css("background-color", "yellow");
    $("#wait-for-serial-ports").css("color", "black");

    $.getJSON( '/serialports', function( data ) {
        console.log(JSON.stringify(data));

        $('#serial_ports').find('option[value!=0]').remove();
        $('#list-of-serial-numbers').html("");

        for(var i = 0; i < data.length; i++){
            var obj = data[i];
            $('#serial_ports').append('<option value="' + obj.serialNumber + '">' + obj.serialNumber + '</option>');
            attachedEggs.push(JSON.parse(JSON.stringify(obj)));
            $('#list-of-serial-numbers').html($('#list-of-serial-numbers').html() + obj.serialNumber + " " + obj.sensorType + "<br/>");
        }

        $("#feedback").css("background-color", "green");
        $("#feedback").css("color", "white");
        $("#feedback").text("Listing Serial Ports... Complete");
        $("#wait-for-serial-ports").fadeOut(1000);

        $("#serial_ports").change(function(){
            $('#egg_serial_number').val($("#serial_ports option:selected").val());
        });

        $("#serial_ports").val($("#serial_ports option:eq(2)").val());
        $('#egg_serial_number').val($("#serial_ports").val());
    });
}



$(function(){

    if($("#wait-for-serial-ports").length) {

        listPorts();

        // attach click events to Serial Port buttons
        $("#list-ports-button").click(function () {
            listPorts();
        });

        $("#commit-form-data-to-serial-port-button").click(function () {
            $("#feedback").css("background-color", "yellow");
            $("#feedback").css("color", "black");
            $("#feedback").text("Committing Serial Data...");

            $.post("/serialports/commit/" + $("#serial_ports option:selected").val(), {
                    "no2-sensitivity": $("#form-data-no2-sensitivity").text(),
                    "no2-offset": $("#form-data-no2-offset").text(),
                    "co-sensitivity": $("#form-data-co-sensitivity").text(),
                    "co-offset": $("#form-data-co-offset").text(),
                    "so2-sensitivity": $("#form-data-so2-sensitivity").text(),
                    "so2-offset": $("#form-data-so2-offset").text(),
                    "o3-sensitivity": $("#form-data-o3-sensitivity").text(),
                    "o3-offset": $("#form-data-o3-offset").text(),
                    "temperature-offset": $("#form-data-temperature-offset").text(),
                    "humidity-offset": $("#form-data-humidity-offset").text(),
                    "mqtt-password": $("#form-data-open-sensors-password").text()
                },
                function () {
                    $("#feedback").css("background-color", "green");
                    $("#feedback").css("color", "white");
                    $("#feedback").text("Committing Serial Data... Complete");
                });
        });

        $("#connect-to-port-button").click(function () {
            $("#feedback").css("background-color", "yellow");
            $("#feedback").css("color", "black");
            $("#feedback").text("Getting Serial Data...");
            clearValidationHighlights();
            $("#comName").text("");

            $("#egg_serial_number").val($("#serial_ports option:selected").val());

            loadFormDataForEgg($("#egg_serial_number").val());

            $.getJSON('/serialports/data/' + $("#serial_ports option:selected").val(), function (data) {
                console.log(data);
                var fields_of_interest_view_map = [
                    {"CC3000 MAC address": "#serial-data-mac-address"},
                    {"Open Sensors .io password": "#serial-data-open-sensors-password"},
                    {"Shipped Firmware Version": "#serial-data-shipped-firmware"},
                    {"CO Sensitivity": "#serial-data-co-sensitivity"},
                    {"CO Sensor Zero Value": "#serial-data-co-offset"},
                    {"NO2 Sensitivity": "#serial-data-no2-sensitivity"},
                    {"NO2 Sensor Zero Value": "#serial-data-no2-offset"},
                    {"O3 Sensitivity": "#serial-data-o3-sensitivity"},
                    {"O3 Sensor Zero Value": "#serial-data-o3-offset"},
                    {"SO2 Sensitivity": "#serial-data-so2-sensitivity"},
                    {"SO2 Sensor Zero Value": "#serial-data-so2-offset"},
                    {"Temperature Offset": "#serial-data-temperature-offset"},
                    {"Humidity Offset": "#serial-data-humidity-offset"},
                    {"OpenSensors Username": "#serial-data-open-sensors-username"},
                    {"Sensor Type": "#sensor-type"}
                ];

                $("#comName").text(data["comName"]);

                for (entry in fields_of_interest_view_map) {
                    var field_map = fields_of_interest_view_map[entry];
                    for (key in field_map) {
                        $(field_map[key]).html("");
                        if (data[key]) {
                            if (data[key].length == 1 && ("" + data[key][0]).trim() != "") {
                                $(field_map[key]).html(("" + data[key][0]).replace(/\n/g, "<br />"));
                            }
                            else if (data[key].length >= 1 && key == "SHT25 / Egg Serial Number") {
                                $(field_map[key]).html(("egg" + data[key][0]).replace(/\n/g, "<br />"));
                            }
                        }
                    }
                }

                $("#feedback").css("background-color", "green");
                $("#feedback").css("color", "white");
                $("#feedback").text("Getting Serial Data... Complete");
            });
        });
    }
});