function listPorts(){
    $("#feedback").css("background-color", "yellow");
    $("#feedback").css("color", "black");
    $("#feedback").text("Listing Serial Ports...");
    $.getJSON( '/serialports', function( data ) {
        console.log(JSON.stringify(data));

        $('#serial_ports').find('option[value!=0]').remove();

        for(var i = 0; i < data.length; i++){
            var obj = data[i];
            $('#serial_ports').append('<option value="' + (i+1) + '">' + obj.serialNumber + '</option>');
            $('#serial_ports option:eq(1)').prop('selected', true);
        }

        $("#feedback").css("background-color", "green");
        $("#feedback").css("color", "white");
        $("#feedback").text("Listing Serial Ports... Complete");
    });
}

$(function(){
    listPorts();

    // attach click events to Serial Port buttons
    $("#list-ports-button").click(function(){
        listPorts();
    });

    $("#connect-to-port-button").click(function(){

    });
});