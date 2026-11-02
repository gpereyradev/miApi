const jwt = require('jsonwebtoken');

module.exports = (rolesPermitidos = []) => {
    return (req, res, next) => {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) {
            return res.status(403).json({ error: 'Acceso denegado: Token no proporcionado.' });
        }
        try {
            const decodificado = jwt.verify(token, process.env.JWT_SECRET);
            req.usuario = decodificado;
            if (rolesPermitidos.length && !rolesPermitidos.includes(decodificado.rol)) {
                return res.status(401).json({ error: 'No autorizado: Permisos insuficientes.' });
            }
            next();
        } catch (error) {
            return res.status(401).json({ error: 'Sesión inválida o expirada.' });
        }
    };
};
