require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const sequelize = require('./config/db');
const Producto = require('./models/Producto');
const Usuario = require('./models/Usuario');
const authRoutes = require('./routes/authRoutes');
const autenticar = require('./middleware/authMiddleware');

const app = express();

// Protección global, antes de las rutas.
app.use(helmet());
app.use(cors({
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
const limitador = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Demasiadas peticiones desde esta IP, por favor intente más tarde.'
});
app.use(['/api', '/productos'], limitador);

// El JSON debe procesarse antes de registrar las rutas de autenticación.
app.use(express.json());
app.use('/api/auth', authRoutes);

app.get('/', (req, res) => {
    res.send('¡API Backend funcionando exitosamente!');
});

// Se admite /productos y /api/productos para las pruebas indicadas en la guía.
const rutasProductos = ['/productos', '/api/productos'];
const rutasProducto = ['/productos/:id', '/api/productos/:id'];
const rolesProductos = ['Administrador', 'Almacenero'];

app.post(rutasProductos, autenticar(rolesProductos), async (req, res) => {
    try {
        const nuevoProducto = await Producto.create(req.body);
        res.status(201).json(nuevoProducto);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get(rutasProductos, autenticar(rolesProductos), async (req, res) => {
    try {
        const productos = await Producto.findAll();
        res.json(productos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put(rutasProducto, autenticar(rolesProductos), async (req, res) => {
    try {
        await Producto.update(req.body, { where: { id: req.params.id } });
        res.json({ message: 'Producto actualizado' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete(rutasProducto, autenticar(rolesProductos), async (req, res) => {
    try {
        await Producto.destroy({ where: { id: req.params.id } });
        res.json({ message: 'Producto eliminado' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3006;
if (require.main === module) {
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
}
module.exports = app;
