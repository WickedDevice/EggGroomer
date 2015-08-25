var express = require('express');
var router = express.Router();

router.get('/', function(req, res, next) {
    res.render('calibration', { title: 'Calibration' });
});

module.exports = router;
