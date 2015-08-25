var fields_of_interest_ids_no_prefix = [
    "data-mac-address",
    "data-open-sensors-password",
    "data-shipped-firmware",
    "data-co-serial-number",
    "data-co-date-code",
    "data-co-sensitivity",
    "data-co-offset",
    "data-no2-serial-number",
    "data-no2-date-code",
    "data-no2-sensitivity",
    "data-no2-offset",
    "data-date-shipped",
    "data-customer-name",
    "data-customer-email",
    "data-customer-order-number",
    "data-customer-address",
    "data-open-sensors-username"
];

function highlightRowError(suffix){
    highlightSerialFieldError(suffix);
    highlightFormFieldError(suffix);
}

function stripPrefix(str, prefix){
    var ret = str;
    if(str.length >= prefix.length && str.slice(0,prefix.length) == prefix){
        ret = str.slice(prefix.length);
    }

    return ret;
}

function highlightSerialFieldError(suffix){
    $("#serial-"+suffix).css("background-color", "red");
    $("#serial-"+suffix).css("color", "white");
}

function highlightFormFieldError(suffix){
    $("#form-"+suffix).css("background-color", "red");
    $("#form-"+suffix).css("color", "white");
}

function unHighlightRowError(suffix){
    $("#form-"+suffix).css("background-color", "white");
    $("#form-"+suffix).css("color", "black");
    $("#serial-"+suffix).css("background-color", "white");
    $("#serial-"+suffix).css("color", "black");
}

function clearValidationHighlights(){
    for(var i = 0; i < fields_of_interest_ids_no_prefix.length; i++){
        unHighlightRowError(fields_of_interest_ids_no_prefix[i]);
    }
}

function validateSerialFieldNotEmpty(suffix){
    if($("#serial-"+suffix).text().trim() == ""){
        highlightSerialFieldError(suffix);
        return false;
    }
    return true;
}

function validateFormFieldNotEmpty(suffix){
    if($("#form-"+suffix).text().trim() == ""){
        highlightFormFieldError(suffix);
        return false;
    }
    return true;
}

function validateRowNotEmpty(suffix){
    var ret = true;
    if(!validateSerialFieldNotEmpty(suffix)){
        ret = false;
    }

    if(!validateFormFieldNotEmpty(suffix)){
        ret = false;
    }

    return ret;
}

function validateEggSerialNumber(suffix){
    var form_serial_number = $("#form-"+suffix).text();
    var serial_serial_number = $("#serial-"+suffix).text();

    // serial_serial_number less the leading 'egg' should match form_serial_number
    if(stripPrefix(form_serial_number, "egg") != stripPrefix(serial_serial_number, "egg")){
        highlightRowError(suffix);
    }
}

function validateValuesEqual(suffix){
    if($("#serial-"+suffix).text() != $("#form-"+suffix).text()){
        highlightRowError(suffix);
        return false;
    }
    return true;
}

function validateSensitivity(suffix){
    if(parseFloat($("#serial-"+suffix).text()) < 0){
        highlightSerialFieldError(suffix);
        return false;
    }
    else if(Math.abs(Math.abs(parseFloat($("#form-"+suffix).text())) - parseFloat($("#serial-"+suffix).text())) > 0.00001){
        highlightRowError(suffix);
        return false;
    }

    return true;
}

function validateOffset(suffix){
    if(Math.abs(parseFloat($("#form-"+suffix).text()) - parseFloat($("#serial-"+suffix).text())) > 0.00001){
        highlightRowError(suffix);
        return false;
    }
    return true;
}

function validateSerialFieldNotEqualToValue(suffix, value){
    if($("#serial-"+suffix).text() == value){
        highlightSerialFieldError(suffix);
        return false;
    }
    return true;
}

function validateFormFieldNotEqualToValue(suffix, value){
    if($("#form-"+suffix).text() == value){
        highlightFormFieldError(suffix);
        return false;
    }
    return true;
}

function validatePopulatedData(){
    var ret = true;

    if(!validateValuesEqual("data-mac-address")){ ret = false; }
    if(!validateRowNotEmpty("data-mac-address")){ ret = false; }
    if(!validateRowNotEmpty("data-open-sensors-password")){ ret = false; }
    if(!validateSerialFieldNotEqualToValue("data-open-sensors-password", "NOT Backed Up")){ ret = false; }
    if(!validateValuesEqual("data-shipped-firmware")){ ret = false; }
    if(!validateFormFieldNotEmpty("data-co-serial-number")){ ret = false; }
    if(!validateFormFieldNotEmpty("data-co-date-code")){ ret = false; }
    if(!validateFormFieldNotEmpty("data-no2-serial-number")){ ret = false; }
    if(!validateFormFieldNotEmpty("data-no2-date-code")){ ret = false; }
    if(!validateSensitivity("data-co-sensitivity")){ ret = false; }
    if(!validateRowNotEmpty("data-co-sensitivity")){ ret = false; }
    if(!validateSensitivity("data-no2-sensitivity")){ ret = false; }
    if(!validateRowNotEmpty("data-no2-sensitivity")){ ret = false; }
    if(!validateOffset("data-co-offset")){ ret = false; }
    if(!validateRowNotEmpty("data-co-offset")){ ret = false; }
    if(!validateOffset("data-no2-offset")){ ret = false; }
    if(!validateRowNotEmpty("data-no2-offset")){ ret = false; }
    if(!validateEggSerialNumber("data-open-sensors-username")){ ret = false; }
    if(!validateRowNotEmpty("data-open-sensors-username")){ ret = false; }
    if(!validateFormFieldNotEmpty("data-date-shipped")){ ret = false; }
    if(!validateFormFieldNotEmpty("data-customer-name")){ ret = false; }
    if(!validateFormFieldNotEmpty("data-customer-email")){ ret = false; }
    if(!validateFormFieldNotEmpty("data-customer-order-number")){ ret = false; }
    if(!validateFormFieldNotEmpty("data-customer-address")){ ret = false; }
    if(!validateOffset("data-temperature-offset")){ ret = false; }
    if(!validateRowNotEmpty("data-temperature-offset")){ ret = false; }
    if(!validateOffset("data-humidity-offset")){ ret = false; }
    if(!validateRowNotEmpty("data-humidity-offset")){ ret = false; }

    return ret;
}

$(function(){
    $("#validate-fields-button").click(function(){
        if(validatePopulatedData()){
            $("#feedback").css("background-color", "green");
            $("#feedback").css("color", "white");
            $("#feedback").text("All fields are valid!");
        }
        else{
            $("#feedback").css("background-color", "red");
            $("#feedback").css("color", "white");
            $("#feedback").text("Some invalid fields are highlighted!");
        }
    });
});