var express = require('express');
var router = express.Router();

router.get('/', function(req, res, next) {
    res.render('wificonnect', { title: 'Wi-Fi Connect' });
});

module.exports = router;