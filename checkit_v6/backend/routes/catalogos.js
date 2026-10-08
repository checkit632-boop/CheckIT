const express = require('express');
const db = require('../db/database');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

router.get('/marcas', (req, res) => res.json(db.prepare('SELECT * FROM marcas ORDER BY nombre_marca').all()));
router.get('/estados', (req, res) => res.json(db.prepare('SELECT * FROM estados').all()));
router.get('/tipos-documento', (req, res) => res.json(db.prepare('SELECT * FROM tipos_documento').all()));
router.get('/tipos-movimiento', (req, res) => res.json(db.prepare('SELECT * FROM tipos_movimiento').all()));

module.exports = router;
