require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const usuariosRoutes = require('./routes/usuarios');
const personasRoutes = require('./routes/personas');
const equiposRoutes = require('./routes/equipos');
const registrosRoutes = require('./routes/registros');
const catalogosRoutes = require('./routes/catalogos');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'CheckIT API' }));

app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/personas', personasRoutes);
app.use('/api/equipos', equiposRoutes);
app.use('/api/registros', registrosRoutes);
app.use('/api/catalogos', catalogosRoutes);

// Manejador de errores genérico
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`🚀 CheckIT API escuchando en http://localhost:${PORT}`);
});
