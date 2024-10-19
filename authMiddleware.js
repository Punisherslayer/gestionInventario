const authMiddleware = (req, res, next) => {
    const db = req.db;

    // 30 minutos en milisegundos
    const sessionDuration = 30 * 60 * 1000;
    const now = Date.now();

    if (req.session.user) {
        if (!req.session.createdAt) {
            req.session.createdAt = now;
        }

        db.query('SELECT * FROM Usuarios WHERE id = ?', [req.session.user.id], (err, results) => {
            if (err) {
                return next(err);
            }

            if (results.length === 0) {
                req.session.destroy((err) => {
                    if (err) {
                        return next(err);
                    }
                    req.flash('error_msg', 'Tu cuenta ha sido eliminada. Por favor, vuelve a iniciar sesión.');
                    return res.redirect('/logup');
                });
                return;
            }

            if (now - req.session.createdAt > sessionDuration) {
                req.session.destroy((err) => {
                    if (err) {
                        return next(err);
                    }
                    req.flash('error_msg', 'Tu sesión ha expirado. Por favor, vuelve a iniciar sesión.');
                    return res.redirect('/logup');
                });
            } else {
                req.session.createdAt = now;
                next();
            }
        });
    } else {
        req.flash('error_msg', 'Debes iniciar sesión para acceder a esta página.');
        res.redirect('/logup');
    }
};

// Middleware para verificar roles
const roleMiddleware = (roles) => {
    return (req, res, next) => {
        if (req.session.user && roles.includes(req.session.user.rol)) {
            return next();
        } else {
            req.flash('error_msg', 'No tienes permisos para acceder a esta página.');
            return res.redirect('/index');
        }
    };
};

module.exports = { authMiddleware, roleMiddleware };
