const Usuario = require('../models/Usuario');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.registrar = async (req, res) => {
    try {
        const { nombre, email, password, rol } = req.body;
        const existe = await Usuario.findOne({ where: { email } });
        if (existe) {
            return res.status(400).json({ error: 'El correo ya se encuentra registrado' });
        }
        const nuevoUsuario = await Usuario.create({ nombre, email, password, rol });
        res.status(201).json({ message: 'Usuario registrado exitosamente', id: nuevoUsuario.id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const usuario = await Usuario.findOne({ where: { email } });
        if (!usuario) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }
        const passwordCorrecto = await bcrypt.compare(password, usuario.password);
        if (!passwordCorrecto) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }
        const token = jwt.sign(
            { id: usuario.id, rol: usuario.rol },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );
        res.json({
            message: 'Inicio de sesión exitoso',
            token,
            usuario: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
