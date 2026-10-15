const express = require('express');
const router = express.Router();
const comandasController = require('../controllers/comandasController');

router.get('/', comandasController.index);

module.exports = router;