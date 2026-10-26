
const express = require('express');
const cors = require('cors');
const sequelize = require('./config/db');
require('dotenv').config();

// Importar modelos para que Sequelize los registre
const Producto = require('./models/Producto');

const app = express();

// --- MIDDLEWARES ---
// Habilitar CORS para permitir peticiones desde el frontend (React)
app.use(cors());
// Parsear el body de las peticiones a JSON
app.use(express.json());

// --- RUTAS BÁSICAS DE PRUEBA ---
app.get('/', (req, res) => {
    res.send('¡API Backend funcionando exitosamente!');
});

// --- SINCRONIZACIÓN Y ARRANQUE ---
const PORT = process.env.PORT || 3306;

// force: false evita que se borren los datos cada vez que se reinicia el servidor
sequelize.sync({ force: false })
    .then(() => {
        console.log('Base de datos conectada y sincronizada.');
        app.listen(PORT, () => {
            console.log(`Servidor corriendo en http://localhost:${PORT}`);
        });
    })
    .catch(error => {
        console.error('Error al conectar con la base de datos:', error);
    });
