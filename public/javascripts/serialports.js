function listPorts(){
    $("#feedback").css("background-color", "yellow");
    $("#feedback").css("color", "black");
    $("#feedback").text("Listing Serial Ports...");
    $.getJSON( '/serialports', function( data ) {
        console.log(JSON.stringify(data));

        $('#serial_ports').find('option[value!=0]').remove();

        for(var i = 0; i < data.length; i++){
            var obj = data[i];
            $('#serial_ports').append('<option value="' + obj.serialNumber + '">' + obj.serialNumber + '</option>');
        }

        $("#feedback").css("background-color", "green");
        $("#feedback").css("color", "white");
        $("#feedback").text("Listing Serial Ports... Complete");

        $("#serial_ports").change(function(){
            $('#egg_serial_number').val($("#serial_ports option:selected").val());
        });

        $("#serial_ports").val($("#serial_ports option:eq(2)").val());
        $('#egg_serial_number').val($("#serial_ports").val());
    });
}



$(function(){
    listPorts();

    // attach click events to Serial Port buttons
    $("#list-ports-button").click(function(){
        listPorts();
    });

    $("#commit-form-data-to-serial-port-button").click(function(){
        $("#feedback").css("background-color", "yellow");
        $("#feedback").css("color", "black");
        $("#feedback").text("Committing Serial Data...");

        $.post("/serialports/commit/" + $("#serial_ports option:selected").val(), {
            "co-sensitivity": $("#form-data-co-sensitivity").text(),
            "co-offset": $("#form-data-co-offset").text(),
            "no2-sensitivity": $("#form-data-no2-sensitivity").text(),
            "no2-offset": $("#form-data-no2-offset").text(),
            "mqtt-password": $("#form-data-open-sensors-password").text()
        },
        function(){
            $("#feedback").css("background-color", "green");
            $("#feedback").css("color", "white");
            $("#feedback").text("Committing Serial Data... Complete");
        });
    });

    $("#connect-to-port-button").click(function(){
        $("#feedback").css("background-color", "yellow");
        $("#feedback").css("color", "black");
        $("#feedback").text("Getting Serial Data...");

        $.getJSON( '/serialports/' + $("#serial_ports option:selected").val(), function( data ) {
            console.log(data);
            var fields_of_interest_view_map = [
                {"CC3000 MAC address": "#serial-data-mac-address"},
                {"Open Sensors .io password": "#serial-data-open-sensors-password"},
                {"Shipped Firmware Version": "#serial-data-shipped-firmware"},
                {"CO Sensitivity": "#serial-data-co-sensitivity"},
                {"CO Sensor Zero Value": "#serial-data-co-offset"},
                {"NO2 Sensitivity": "#serial-data-no2-sensitivity"},
                {"NO2 Sensor Zero Value": "#serial-data-no2-offset"},
                {"SHT25 / Egg Serial Number": "#serial-data-open-sensors-username" }
            ];

            for(entry in fields_of_interest_view_map){
                var field_map = fields_of_interest_view_map[entry];
                for(key in field_map){
                    $(field_map[key]).html("");
                    if(data[key]){
                        if(data[key].length == 1 && (""+data[key][0]).trim() != "") {
                            $(field_map[key]).html(("" + data[key][0]).replace(/\n/g, "<br />"));
                        }
                        else if(data[key].length >= 1 && key == "SHT25 / Egg Serial Number"){
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
});