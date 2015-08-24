$(function(){
    $('#get-form-data-button').click(function() {

        $("#feedback").css("background-color", "yellow");
        $("#feedback").css("color", "black");
        $("#feedback").text("Getting Form Data...");

        $.getJSON( '/eggformdata?egg_serial_number=' + $("#egg_serial_number").val(), function( data ) {
            console.log(data);
            var fields_of_interest_view_map = [
                {"CC3000 MAC address": "#form-data-mac-address"},
                {"Open Sensors .io password": "#form-data-open-sensors-password"},
                {"Shipped Firmware Version": "#form-data-shipped-firmware"},
                {"CO Serial Number": "#form-data-co-serial-number"},
                {"CO Date Code": "#form-data-co-date-code"},
                {"CO Sensitivity": "#form-data-co-sensitivity"},
                {"CO Sensor Zero Value": "#form-data-co-offset"},
                {"NO2 Sensor Serial Number": "#form-data-no2-serial-number"},
                {"NO2 Sensor Date Code": "#form-data-no2-date-code"},
                {"NO2 Sensitivity": "#form-data-no2-sensitivity"},
                {"NO2 Sensor Zero Value": "#form-data-no2-offset"},
                {"Date Shipped to customer": "#form-data-date-shipped"},
                {"Customer Name": "#form-data-customer-name"},
                {"Customer Email": "#form-data-customer-email"},
                {"Customer Order Number": "#form-data-customer-order-number"},
                {"Customer Address": "#form-data-customer-address"}
            ];

            for(entry in fields_of_interest_view_map){
                var field_map = fields_of_interest_view_map[entry];
                for(key in field_map){
                    $(field_map[key]).html("");
                    if(data[key] && data[key].length == 1 && (""+data[key][0]).trim() != ""){
                        $(field_map[key]).html((""+data[key][0]).replace(/\n/g, "<br />"));
                    }
                }
            }

            $("#feedback").css("background-color", "green");
            $("#feedback").css("color", "white");
            $("#feedback").text("Getting Form Data... Complete");
        });
    });
});