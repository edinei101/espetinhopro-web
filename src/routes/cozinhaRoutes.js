const express = require('express');
const router = express.Router();
const cozinhaController = require('../controllers/cozinhaController');

router.get('/', cozinhaController.index);

module.exports = router;