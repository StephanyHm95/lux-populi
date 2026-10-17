//Comprobación de sesion

//acceso solo a usuarios logueados
function requiereSesion(req, res, next) {
    if (!req.session.usuario){
        return res.status(401).json({ error: 'Tienes que iniciar sesión' });
    }
    next();
}

//acceso a usarios logueados y con el rol adecuado

function requiereRol(rol) {
    return function(req, res, next) {
        if (!req.session.usuario) {
            return res.status(401).json({ error: 'Tienes que iniciar sesión' });
        }
        if (req.session.usuario.rol !== rol) {
            return res.status(403).json({ error: 'No tienes permisos para hacer esto' });
        }
        next();
    };
}

module.exports = { requiereSesion, requiereRol };