const express = require('express');
const db = require('../db/database');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

router.use(authRequired);

router.get('/', (req, res) => {

    // Total de equipos
    const equipos = db.prepare(`
        SELECT COUNT(*) AS total
        FROM equipos
    `).get().total;

    // Entradas de hoy
    const entradasHoy = db.prepare(`
        SELECT COUNT(*) AS total
        FROM registros r
        JOIN tipos_movimiento tm
        ON tm.id_tipo_movimiento = r.id_tipo_movimiento
        WHERE tm.nombre_movimiento='Entrada'
        AND date(r.fecha_hora)=date('now','localtime')
    `).get().total;

    // Salidas de hoy
    const salidasHoy = db.prepare(`
        SELECT COUNT(*) AS total
        FROM registros r
        JOIN tipos_movimiento tm
        ON tm.id_tipo_movimiento = r.id_tipo_movimiento
        WHERE tm.nombre_movimiento='Salida'
        AND date(r.fecha_hora)=date('now','localtime')
    `).get().total;

    // Equipos actualmente dentro
    const equiposDentro = db.prepare(`
        SELECT COUNT(*) AS total
        FROM equipos e
        WHERE EXISTS(
            SELECT 1
            FROM registros r
            JOIN tipos_movimiento tm
            ON tm.id_tipo_movimiento=r.id_tipo_movimiento
            WHERE r.id_equipo=e.id_equipo
            ORDER BY r.fecha_hora DESC,r.id_registro DESC
            LIMIT 1
        )
        AND (
            SELECT tm.nombre_movimiento
            FROM registros r
            JOIN tipos_movimiento tm
            ON tm.id_tipo_movimiento=r.id_tipo_movimiento
            WHERE r.id_equipo=e.id_equipo
            ORDER BY r.fecha_hora DESC,r.id_registro DESC
            LIMIT 1
        )='Entrada'
    `).get().total;

    res.json({
        equipos,
        equiposDentro,
        entradasHoy,
        salidasHoy

    });

});

module.exports = router;