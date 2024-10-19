require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');
const bcrypt = require('bcrypt');
const { authMiddleware, roleMiddleware } = require('./authMiddleware');
const app = express();
const multer = require('multer');
const xlsx = require('xlsx');
const csv = require('csv-parser');
const fs = require('fs');
const port = 3000;

// Configuración de la base de datos
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

// Conexión a la base de datos
db.connect(err => {
    if (err) {
        console.error('Error conectando a la base de datos:', err);
        return;
    }
    console.log('Conectado a la base de datos MySQL.');

    // Crear el usuario admin después de la conexión
    crearAdmin();
});

// Usuario Admin
async function crearAdmin() {
    const hashedPassword = await bcrypt.hash('123', 10);
    const query = 'INSERT INTO Usuarios (username, email, password, rol, activo) VALUES (?, ?, ?, ?, ?)';
    
    db.query(query, ['daniel.reyzabal', 'daniel.reyzabal@educa.madrid.org', hashedPassword, 'admin', true], (err, results) => {
        if (err) {
            console.error('Error al insertar el admin:', err);
        } else {
            console.log('Admin insertado con éxito:', results);
        }
    });
}

// Función query para usarla como wrapper sobre db.query
const query = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.query(sql, params, (err, results) => {
            if (err) {
                reject(err);
            } else {
                resolve(results);
            }
        });
    });
};

// Middleware para añadir la conexión a la base de datos a req
app.use((req, res, next) => {
    req.db = db;
    next();
});

// Configuración de sesión y flash
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 30 * 60 * 1000 }
}));

// Inicializa flash
app.use(flash());

// Middleware para pasar los mensajes flash a todas las vistas
app.use((req, res, next) => {
    res.locals.messages = req.flash();
    next();
});

app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Ruta raíz
app.get('/', (req, res) => {
    res.redirect('/logup');
});

// Ruta de inicio de sesión y registro (sin authMiddleware)
app.get('/logup', (req, res) => {
    res.render('logup');
});

// Ruta principal después de iniciar sesión
app.get('/index', authMiddleware, (req, res) => {
    res.render('index', { user: req.session.user });
});

// Registro de usuario
app.post('/signup', async (req, res) => {
    const { username, email, password } = req.body;

    // Validar el correo electrónico para que sea del dominio educa.madrid.org
    const emailRegex = /^[a-zA-Z0-9._%+-]+@educa\.madrid\.org$/;
    if (!emailRegex.test(email)) {
        req.flash('error_msg', 'Solo se permite el registro con correos de educa.madrid.org');
        return res.redirect('/logup');
    }

    // Continuar con el registro si el correo es válido
    const hashedPassword = await bcrypt.hash(password, 10);
    req.db.query('INSERT INTO Usuarios (username, email, password, rol) VALUES (?, ?, ?, "usuario")', [username, email, hashedPassword], (err, results) => {
        if (err) {
            req.flash('error_msg', 'Error al registrarse. Inténtalo de nuevo.');
            return res.redirect('/logup');
        }
        req.flash('success_msg', 'Registro exitoso. Ahora puedes iniciar sesión.');
        res.redirect('/logup');
    });
});

// Iniciar sesión (sin authMiddleware)
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    req.db.query('SELECT * FROM Usuarios WHERE email = ?', [email], async (err, results) => {
        if (err) {
            req.flash('error_msg', 'Error al intentar iniciar sesión. Inténtalo de nuevo.');
            return res.redirect('/logup');
        }

        if (results.length > 0) {
            const user = results[0];
            const match = await bcrypt.compare(password, user.password);
            if (match) {
                req.session.user = user;
                req.session.createdAt = Date.now();

                // Actualizar la fecha de último acceso
                const updateLastAccessSql = 'UPDATE Usuarios SET fecha_ultimo_acceso = CURRENT_TIMESTAMP WHERE id = ?';
                req.db.query(updateLastAccessSql, [user.id], (err) => {
                    if (err) {
                        console.error('Error al actualizar la fecha de último acceso:', err);
                    } else {
                        console.log('Fecha de último acceso actualizada correctamente.');
                    }
                });

                req.flash('success_msg', '¡Bienvenido! Has iniciado sesión correctamente.');
                return res.redirect('/index');
            } else {
                req.flash('error_msg', 'Credenciales inválidas');
                return res.redirect('/logup');
            }
        } else {
            req.flash('error_msg', 'Credenciales inválidas');
            return res.redirect('/logup');
        }
    });
});

// Cerrar sesión
app.get('/logout', authMiddleware, (req, res) => {
    req.session.destroy(err => {
        if (err) throw err;
        res.redirect('/logup');
    });
});

// ==========================
// Equipos
// ==========================

// Rutas para dar de alta equipos
app.get('/equipos/alta', authMiddleware, roleMiddleware(['admin', 'tecnico']), (req, res) => {
    db.query('SELECT * FROM Ubicaciones', (err, ubicaciones) => {
        if (err) throw err;
        res.render('equipos/equipos', { ubicaciones });
    });
});

app.post('/equipos/alta', authMiddleware, roleMiddleware(['admin', 'tecnico']), (req, res) => {
    const { tipo, marca, modelo, sistema_operativo, placa_base, procesador, memoria_ram, disco_duro, tarjeta_grafica, sistema_refrigeracion, unidad_optica, tarjeta_sonido, tarjeta_red, teclado, raton, monitor, altavoces, cables_conectores, id_ubicacion, estado } = req.body;
    
    db.query(
        'INSERT INTO Equipos (tipo, marca, modelo, sistema_operativo, placa_base, procesador, memoria_ram, disco_duro, tarjeta_grafica, sistema_refrigeracion, unidad_optica, tarjeta_sonido, tarjeta_red, teclado, raton, monitor, altavoces, cables_conectores, id_ubicacion, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [tipo, marca, modelo, sistema_operativo, placa_base, procesador, memoria_ram, disco_duro, tarjeta_grafica, sistema_refrigeracion, unidad_optica, tarjeta_sonido, tarjeta_red, teclado, raton, monitor, altavoces, cables_conectores, id_ubicacion, estado],
        (err, results) => {
            if (err) throw err;
            res.redirect('/ubicaciones/listar');
        }
    );
});

// Configuración de almacenamiento con multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// Ruta para cargar archivos
app.post('/equipos/upload', authMiddleware, roleMiddleware(['admin', 'tecnico']), upload.single('file'), (req, res) => {
    const file = req.file;

    if (!file) {
        req.flash('error_msg', 'No se ha subido ningún archivo');
        return res.redirect('/equipos/listar');
    }

    const fileExtension = file.mimetype.split('/')[1];

    // Procesar archivo CSV
    if (fileExtension === 'csv') {
        const equipos = [];
        fs.createReadStream(file.path)
            .pipe(csv())
            .on('data', (row) => {
                equipos.push(row);
            })
            .on('end', () => {
                // Insertar equipos en la base de datos
                equipos.forEach(equipo => {
                    const { tipo, marca, modelo, sistema_operativo, placa_base, procesador, memoria_ram, disco_duro, tarjeta_grafica, sistema_refrigeracion, unidad_optica, tarjeta_sonido, tarjeta_red, teclado, raton, monitor, altavoces, cables_conectores, id_ubicacion, estado } = equipo;

                    db.query(
                        'INSERT INTO Equipos (tipo, marca, modelo, sistema_operativo, placa_base, procesador, memoria_ram, disco_duro, tarjeta_grafica, sistema_refrigeracion, unidad_optica, tarjeta_sonido, tarjeta_red, teclado, raton, monitor, altavoces, cables_conectores, id_ubicacion, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        [tipo, marca, modelo, sistema_operativo, placa_base, procesador, memoria_ram, disco_duro, tarjeta_grafica, sistema_refrigeracion, unidad_optica, tarjeta_sonido, tarjeta_red, teclado, raton, monitor, altavoces, cables_conectores, id_ubicacion, estado],
                        (err, results) => {
                            if (err) {
                                console.error('Error al insertar equipo:', err);
                            }
                        }
                    );
                });
                req.flash('success_msg', 'Equipos cargados exitosamente');
                res.redirect('/equipos/listar');
            });
    }

    // Procesar archivo Excel
    else if (fileExtension === 'spreadsheetml') {
        const workbook = xlsx.readFile(file.path);
        const sheet_name_list = workbook.SheetNames;
        const equipos = xlsx.utils.sheet_to_json(workbook.Sheets[sheet_name_list[0]]);
        
        equipos.forEach(equipo => {
            const { tipo, marca, modelo, sistema_operativo, placa_base, procesador, memoria_ram, disco_duro, tarjeta_grafica, sistema_refrigeracion, unidad_optica, tarjeta_sonido, tarjeta_red, teclado, raton, monitor, altavoces, cables_conectores, id_ubicacion, estado } = equipo;

            db.query(
                'INSERT INTO Equipos (tipo, marca, modelo, sistema_operativo, placa_base, procesador, memoria_ram, disco_duro, tarjeta_grafica, sistema_refrigeracion, unidad_optica, tarjeta_sonido, tarjeta_red, teclado, raton, monitor, altavoces, cables_conectores, id_ubicacion, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [tipo, marca, modelo, sistema_operativo, placa_base, procesador, memoria_ram, disco_duro, tarjeta_grafica, sistema_refrigeracion, unidad_optica, tarjeta_sonido, tarjeta_red, teclado, raton, monitor, altavoces, cables_conectores, id_ubicacion, estado],
                (err, results) => {
                    if (err) {
                        console.error('Error al insertar equipo:', err);
                    }
                }
            );
        });
        req.flash('success_msg', 'Equipos cargados exitosamente');
        res.redirect('/equipos/listar');
    } else {
        req.flash('error_msg', 'Formato de archivo no soportado');
        return res.redirect('/equipos/listar');
    }
});

// Rutas para listar equipos con filtro
app.get('/equipos/listar', authMiddleware, roleMiddleware(['admin', 'tecnico']), (req, res) => {
    const { tipo, marca, sistema_operativo, ubicacion, fecha_creacion_desde, fecha_modificacion_hasta } = req.query;
    
    let query = `
        SELECT e.id_equipo, e.tipo, e.marca, e.modelo, e.sistema_operativo, u.nombre_ubicacion, e.estado,
               e.placa_base, e.procesador, e.memoria_ram, e.disco_duro,
               e.tarjeta_grafica, e.sistema_refrigeracion, e.unidad_optica,
               e.tarjeta_sonido, e.tarjeta_red, e.teclado, e.raton,
               e.monitor, e.altavoces, e.cables_conectores, e.fecha_creacion, e.fecha_modificacion
        FROM Equipos e
        JOIN Ubicaciones u ON e.id_ubicacion = u.id_ubicacion
        WHERE 1=1
    `;

    const params = [];

    if (tipo) {
        query += " AND e.tipo = ?";
        params.push(tipo);
    }

    if (marca) {
        query += " AND e.marca LIKE ?";
        params.push(`%${marca}%`);
    }

    if (sistema_operativo) {
        query += " AND e.sistema_operativo = ?";
        params.push(sistema_operativo);
    }

    if (ubicacion) {
        query += " AND e.id_ubicacion = ?";
        params.push(ubicacion);
    }

    if (fecha_creacion_desde) {
        query += " AND e.fecha_creacion >= ?";
        params.push(fecha_creacion_desde);
    }

    if (fecha_modificacion_hasta) {
        query += " AND e.fecha_modificacion <= ?";
        params.push(fecha_modificacion_hasta);
    }

    db.query(query, params, (err, results) => {
        if (err) throw err;

        // Consulta para obtener las ubicaciones disponibles para el filtro
        db.query("SELECT id_ubicacion, nombre_ubicacion FROM Ubicaciones", (err, ubicaciones) => {
            if (err) throw err;
            res.render('equipos/equipos_listar', { equipos: results, ubicaciones: ubicaciones, messages: req.flash() });
        });
    });
});

// Ruta para mostrar el formulario de actualización de un equipo
app.get('/equipos/actualizar/:id', authMiddleware, roleMiddleware(['admin', 'tecnico']), (req, res) => {
    const equipoId = req.params.id;
    
    db.query('SELECT * FROM Equipos WHERE id_equipo = ?', [equipoId], (err, results) => {
        if (err) throw err;
        
        if (results.length > 0) {
            db.query('SELECT * FROM Ubicaciones', (err, ubicaciones) => {
                if (err) throw err;
                res.render('equipos/equipos_actualizar', { equipo: results[0], ubicaciones });
            });
        } else {
            res.status(404).send('Equipo no encontrado');
        }
    });
});

// Ruta para manejar la actualización de un equipo
app.post('/equipos/actualizar/:id', authMiddleware, roleMiddleware(['admin', 'tecnico']), (req, res) => {
    const equipoId = req.params.id;
    const { tipo, marca, modelo, sistema_operativo, placa_base, procesador, memoria_ram, disco_duro, tarjeta_grafica, sistema_refrigeracion, unidad_optica, tarjeta_sonido, tarjeta_red, teclado, raton, monitor, altavoces, cables_conectores, id_ubicacion, estado } = req.body;

    db.query(
        `UPDATE Equipos SET tipo = ?, marca = ?, modelo = ?, sistema_operativo = ?, placa_base = ?, procesador = ?, memoria_ram = ?, disco_duro = ?, tarjeta_grafica = ?, sistema_refrigeracion = ?, unidad_optica = ?, tarjeta_sonido = ?, tarjeta_red = ?, teclado = ?, raton = ?, monitor = ?, altavoces = ?, cables_conectores = ?, id_ubicacion = ?, estado = ? WHERE id_equipo = ?`,
        [tipo, marca, modelo, sistema_operativo, placa_base, procesador, memoria_ram, disco_duro, tarjeta_grafica, sistema_refrigeracion, unidad_optica, tarjeta_sonido, tarjeta_red, teclado, raton, monitor, altavoces, cables_conectores, id_ubicacion, estado, equipoId],
        (err, results) => {
            if (err) throw err;
            res.redirect('/ubicaciones/listar');
        }
    );
});

// Eliminar un equipo
app.post('/equipos/eliminar/:id_equipo', authMiddleware, roleMiddleware(['admin', 'tecnico']), async (req, res) => {
    const { id_equipo } = req.params;

    try {
        // Primero, eliminar las incidencias asociadas al equipo
        await query('DELETE FROM Incidencias WHERE id_equipo = ?', [id_equipo]);

        // Luego, eliminar el mantenimiento asociado al equipo
        await query('DELETE FROM Mantenimiento WHERE id_equipo = ?', [id_equipo]);

        // Finalmente, eliminar el equipo
        await query('DELETE FROM Equipos WHERE id_equipo = ?', [id_equipo]);

        // Agregar mensaje de éxito
        req.flash('success', 'Equipo eliminado exitosamente');
        res.redirect('/equipos/listar');
    } catch (err) {
        console.error('Error al eliminar el equipo y sus registros asociados:', err);
        res.status(500).send('Error al eliminar el equipo y sus registros asociados');
    }
});

// ==========================
// Hardware
// ==========================

// Rutas para dar de alta hardware
app.get('/hardware/alta', authMiddleware, roleMiddleware(['admin', 'tecnico']), (req, res) => {
    db.query('SELECT * FROM Ubicaciones', (err, ubicaciones) => {
        if (err) throw err;
        res.render('hardware/hardware', { ubicaciones });
    });
});

app.post('/hardware/alta', authMiddleware, roleMiddleware(['admin', 'tecnico']), (req, res) => {
    const { tipo_componente, marca, modelo, especificaciones, estado, id_ubicacion } = req.body;
    db.query('INSERT INTO Hardware (tipo_componente, marca, modelo, especificaciones, estado, id_ubicacion) VALUES (?, ?, ?, ?, ?, ?)', 
    [tipo_componente, marca, modelo, especificaciones, estado, id_ubicacion], (err, results) => {
        if (err) throw err;
        res.redirect('/ubicaciones/listar');
    });
});

// Rutas para listar hardware con filtros
app.get('/hardware/listar', authMiddleware, roleMiddleware(['admin', 'tecnico']), (req, res) => {
    const { tipo_componente, marca, estado, id_ubicacion, fecha_creacion, fecha_modificacion } = req.query;

    let query = `
        SELECT h.id_hardware, h.tipo_componente, h.marca, h.modelo, h.especificaciones, h.estado, u.nombre_ubicacion, h.fecha_creacion, h.fecha_modificacion
        FROM Hardware h
        JOIN Ubicaciones u ON h.id_ubicacion = u.id_ubicacion
        WHERE 1=1
    `;

    const filters = [];
    const values = [];

    if (tipo_componente) {
        filters.push('h.tipo_componente = ?');
        values.push(tipo_componente);
    }

    if (marca) {
        filters.push('h.marca LIKE ?');
        values.push(`%${marca}%`);
    }

    if (estado) {
        filters.push('h.estado = ?');
        values.push(estado);
    }

    if (id_ubicacion) {
        filters.push('h.id_ubicacion = ?');
        values.push(id_ubicacion);
    }

    if (fecha_creacion) {
        filters.push('h.fecha_creacion >= ?');
        values.push(`${fecha_creacion} 00:00:00`);
    }

    if (fecha_modificacion) {
        filters.push('h.fecha_modificacion <= ?');
        values.push(`${fecha_modificacion} 23:59:59`);
    }

    if (filters.length > 0) {
        query += ' AND ' + filters.join(' AND ');
    }

    db.query(query, values, (err, results) => {
        if (err) throw err;

        db.query('SELECT * FROM Ubicaciones', (err, ubicaciones) => {
            if (err) throw err;
            res.render('hardware/hardware_listar', { hardware: results, ubicaciones });
        });
    });
});

// Ruta para mostrar el formulario de actualización de hardware
app.get('/hardware/actualizar/:id_hardware', authMiddleware, roleMiddleware(['admin', 'tecnico']), (req, res) => {
    const { id_hardware } = req.params;

    db.query('SELECT * FROM Hardware WHERE id_hardware = ?', [id_hardware], (err, hardwareResults) => {
        if (err) throw err;
        db.query('SELECT * FROM Ubicaciones', (err, ubicacionesResults) => {
            if (err) throw err;
            res.render('hardware/hardware_actualizar', { hardware: hardwareResults[0], ubicaciones: ubicacionesResults });
        });
    });
});

// Ruta para manejar la actualización de hardware
app.post('/hardware/actualizar/:id_hardware', authMiddleware, roleMiddleware(['admin', 'tecnico']), (req, res) => {
    const { tipo_componente, marca, modelo, especificaciones, estado } = req.body;
    const { id_hardware } = req.params;
    db.query(
        'UPDATE Hardware SET tipo_componente = ?, marca = ?, modelo = ?, especificaciones = ?, estado = ? WHERE id_hardware = ?',
        [tipo_componente, marca, modelo, especificaciones, estado, id_hardware],
        (err, result) => {
            if (err) throw err;
            res.redirect('/ubicaciones/listar');
        }
    );
});

// Eliminar hardware
app.post('/hardware/eliminar/:id_hardware', authMiddleware, roleMiddleware(['admin', 'tecnico']), (req, res) => {
    const { id_hardware } = req.params;
    db.query('DELETE FROM Hardware WHERE id_hardware = ?', [id_hardware], (err, result) => {
        if (err) throw err;
        res.redirect('/hardware/listar');
    });
});

// ==========================
// Software
// ==========================

// Rutas para dar de alta software
app.get('/software/alta', authMiddleware, roleMiddleware(['admin', 'tecnico']), (req, res) => {
    res.render('software/software');
});

app.post('/software/alta', authMiddleware, roleMiddleware(['admin', 'tecnico']), (req, res) => {
    const { nombre, version, fecha_vencimiento, detalles_licencia } = req.body;
    db.query('INSERT INTO Software (nombre, version, fecha_vencimiento, detalles_licencia) VALUES (?, ?, ?, ?)', [nombre, version, fecha_vencimiento, detalles_licencia], (err, results) => {
        if (err) throw err;
        res.redirect('/software/listar');
    });
});

// Rutas para listar software con filtros
app.get('/software/listar', authMiddleware, roleMiddleware(['admin', 'tecnico']), (req, res) => {
    let { fecha_vencimiento, fecha_creacion, fecha_modificacion } = req.query;
    let whereConditions = [];

    // Generar condiciones de filtro si se proporcionan
    if (fecha_vencimiento) {
        whereConditions.push(`fecha_vencimiento = '${fecha_vencimiento}'`);
    }
    if (fecha_creacion) {
        whereConditions.push(`fecha_creacion = '${fecha_creacion}'`);
    }
    if (fecha_modificacion) {
        whereConditions.push(`fecha_modificacion = '${fecha_modificacion}'`);
    }

    // Construir la consulta SQL con las condiciones de filtro
    let query = 'SELECT * FROM Software';
    if (whereConditions.length > 0) {
        query += ' WHERE ' + whereConditions.join(' AND ');
    }

    db.query(query, (err, results) => {
        if (err) throw err;
        // Pasar los valores de los filtros a la vista
        res.render('software/software_listar', { 
            software: results,
            fecha_vencimiento: fecha_vencimiento || '',
            fecha_creacion: fecha_creacion || '',
            fecha_modificacion: fecha_modificacion || ''
        });
    });
});

// Ruta para mostrar el formulario de actualización de software
app.get('/software/actualizar/:id_software', authMiddleware, roleMiddleware(['admin', 'tecnico']), (req, res) => {
    const { id_software } = req.params;
    db.query('SELECT * FROM Software WHERE id_software = ?', [id_software], (err, results) => {
        if (err) throw err;
        res.render('software/software_actualizar', { software: results[0] });
    });
});

// Ruta para manejar la actualización de software
app.post('/software/actualizar/:id_software', authMiddleware, roleMiddleware(['admin', 'tecnico']), (req, res) => {
    const { nombre, version, fecha_vencimiento, detalles_licencia } = req.body;
    const { id_software } = req.params;
    db.query(
        'UPDATE Software SET nombre = ?, version = ?, fecha_vencimiento = ?, detalles_licencia = ? WHERE id_software = ?',
        [nombre, version, fecha_vencimiento, detalles_licencia, id_software],
        (err, result) => {
            if (err) throw err;
            res.redirect('/software/listar');
        }
    );
});

// Eliminar software
app.post('/software/eliminar/:id_software', authMiddleware, roleMiddleware(['admin', 'tecnico']), (req, res) => {
    const { id_software } = req.params;
    db.query('DELETE FROM Software WHERE id_software = ?', [id_software], (err, result) => {
        if (err) throw err;
        res.redirect('/software/listar');
    });
});

// ==========================
// Incidencias Equipos
// ==========================

// Rutas para dar de alta incidencias de equipos
app.get('/incidencias_equipos/alta', authMiddleware, roleMiddleware(['admin', 'tecnico', 'usuario']), async (req, res) => {
    try {
        const equipos = await query('SELECT * FROM Equipos');
        const usuarios = await query('SELECT * FROM Usuarios');
        const ubicaciones = await query('SELECT * FROM Ubicaciones');
        res.render('equipos/incidencias_equipos', { equipos, usuarios, ubicaciones });
    } catch (err) {
        console.error('Error al cargar el formulario de alta de incidencias:', err);
        res.status(500).send('Error al procesar la solicitud');
    }
});

// Ruta para registrar una incidencia de equipos
app.post('/incidencias_equipos/alta', authMiddleware, roleMiddleware(['admin', 'tecnico', 'usuario']), (req, res) => {
    const { descripcion_incidencia, fecha_reporte, estado, prioridad, id_ubicacion, id_equipo, id_usuario } = req.body;

    const nuevaIncidencia = {
        descripcion_incidencia,
        fecha_reporte,
        estado,
        prioridad,
        id_ubicacion,
        id_equipo,
        id_usuario
    };

    // Inserta la nueva incidencia en la base de datos de equipos
    db.query('INSERT INTO incidencias SET ?', nuevaIncidencia, (error, results) => {
        if (error) {
            return res.status(500).send('Error al registrar la incidencia');
        }
        res.redirect('/incidencias_equipos/listar');
    });
});

// Rutas para listar incidencias de equipos con filtros
app.get('/incidencias_equipos/listar', authMiddleware, roleMiddleware(['admin', 'tecnico', 'usuario']), async (req, res) => {
    const { fecha_reporte, estado, prioridad, id_ubicacion, fecha_creacion, fecha_modificacion } = req.query;

    let queryString = `
        SELECT 
            i.id_incidencia, 
            i.descripcion_incidencia, 
            i.fecha_reporte, 
            i.estado, 
            i.prioridad,
            i.fecha_creacion,
            i.fecha_modificacion, 
            e.marca AS nombre_equipo, 
            u.username AS nombre_usuario, 
            loc.nombre_ubicacion
        FROM 
            Incidencias i
        JOIN 
            Ubicaciones loc ON i.id_ubicacion = loc.id_ubicacion
        JOIN 
            Usuarios u ON i.id_usuario = u.id
        JOIN 
            Equipos e ON i.id_equipo = e.id_equipo
        WHERE 1=1
    `;

    const filters = [];
    
    if (fecha_reporte) {
        queryString += ` AND i.fecha_reporte = ?`;
        filters.push(fecha_reporte);
    }

    if (estado) {
        queryString += ` AND i.estado = ?`;
        filters.push(estado);
    }

    if (prioridad) {
        queryString += ` AND i.prioridad = ?`;
        filters.push(prioridad);
    }

    if (id_ubicacion) {
        queryString += ` AND i.id_ubicacion = ?`;
        filters.push(id_ubicacion);
    }

    if (fecha_creacion) {
        queryString += ` AND i.fecha_creacion = ?`;
        filters.push(fecha_creacion);
    }

    if (fecha_modificacion) {
        queryString += ` AND i.fecha_modificacion = ?`;
        filters.push(fecha_modificacion);
    }

    try {
        const results = await query(queryString, filters);
        const ubicaciones = await query('SELECT * FROM Ubicaciones');
        res.render('equipos/incidencias_equipos_listar', { incidencias: results, ubicaciones, messages: req.flash() });
    } catch (err) {
        console.error('Error al listar incidencias:', err);
        res.status(500).send('Error al procesar la solicitud');
    }
});

// Ruta para mostrar el formulario de actualización de incidencias de equipos
app.get('/incidencias_equipos/actualizar/:id_incidencia', authMiddleware, roleMiddleware(['admin', 'tecnico', 'usuario']), async (req, res) => {
    const { id_incidencia } = req.params;

    try {
        const incidenciaResults = await query('SELECT * FROM Incidencias WHERE id_incidencia = ?', [id_incidencia]);
        const equiposResults = await query('SELECT * FROM Equipos');
        const usuariosResults = await query('SELECT * FROM Usuarios');
        const ubicacionesResults = await query('SELECT * FROM Ubicaciones');

        res.render('equipos/incidencias_equipos_actualizar', {
            incidencia: incidenciaResults[0],
            equipos: equiposResults,
            usuarios: usuariosResults,
            ubicaciones: ubicacionesResults
        });
    } catch (err) {
        console.error('Error al cargar el formulario de actualización de incidencias:', err);
        res.status(500).send('Error al procesar la solicitud');
    }
});

// Ruta para manejar la actualización de incidencias de equipos
app.post('/incidencias_equipos/actualizar/:id_incidencia', authMiddleware, roleMiddleware(['admin', 'tecnico', 'usuario']), async (req, res) => {
    const { descripcion_incidencia, fecha_reporte, estado, prioridad, id_equipo, id_usuario, id_ubicacion } = req.body;
    const { id_incidencia } = req.params;

    try {
        await query(
            'UPDATE Incidencias SET descripcion_incidencia = ?, fecha_reporte = ?, estado = ?, prioridad = ?, id_equipo = ?, id_usuario = ?, id_ubicacion = ? WHERE id_incidencia = ?',
            [descripcion_incidencia, fecha_reporte, estado, prioridad, id_equipo, id_usuario, id_ubicacion, id_incidencia]
        );
        res.redirect('/incidencias_equipos/listar');
    } catch (err) {
        console.error('Error al actualizar la incidencia:', err);
        res.status(500).send('Error al procesar la solicitud');
    }
});

// Eliminar incidencia de equipos
app.post('/incidencias_equipos/eliminar/:id', authMiddleware, roleMiddleware(['admin', 'tecnico', 'usuario']), async (req, res) => {
    const idIncidencia = req.params.id;
    
    try {
        // Primero, eliminar el mantenimiento asociado a la incidencia de equipos
        await query('DELETE FROM Mantenimiento WHERE id_equipo = (SELECT id_equipo FROM Incidencias WHERE id_incidencia = ?)', [idIncidencia]);

        // Luego, eliminar la incidencia de equipos
        await query('DELETE FROM Incidencias WHERE id_incidencia = ?', [idIncidencia]);

        // Agregar mensaje de éxito
        req.flash('success', 'Incidencia eliminada exitosamente');
        res.redirect('/incidencias_equipos/listar');
    } catch (error) {
        console.error('Error al eliminar la incidencia y su mantenimiento:', error);
        res.status(500).send('Error al eliminar incidencia y mantenimiento');
    }
});

// Ruta para obtener equipos por ubicación 
app.get('/equipos/ubicacion/:idUbicacion', authMiddleware, roleMiddleware(['admin', 'tecnico', 'usuario']), async (req, res) => {
    const { idUbicacion } = req.params;
    try {
        const equipos = await query('SELECT * FROM Equipos WHERE id_ubicacion = ?', [idUbicacion]);
        res.json(equipos);
    } catch (err) {
        console.error('Error al obtener los equipos:', err);
        res.status(500).json({ error: 'Error al obtener los equipos' });
    }
});

// ==========================
// Mantenimiento Equipos
// ==========================

// Rutas para dar de alta mantenimiento de equipos
app.get('/mantenimiento_equipos/alta', authMiddleware, roleMiddleware(['admin', 'tecnico']), async (req, res) => {
    try {
        const equipos = await query('SELECT * FROM Equipos');
        const usuarios = await query('SELECT * FROM Usuarios');
        const ubicaciones = await query('SELECT * FROM Ubicaciones');
        res.render('equipos/mantenimiento_equipos', { equipos, usuarios, ubicaciones });
    } catch (err) {
        console.error('Error al cargar el formulario de alta de mantenimiento:', err);
        res.status(500).send('Error al procesar la solicitud');
    }
});

// Ruta para dar de alta mantenimiento de equipos
app.post('/mantenimiento_equipos/alta', authMiddleware, roleMiddleware(['admin', 'tecnico']), async (req, res) => {
    const { tipo, descripcion_mantenimiento, fecha_mantenimiento, id_ubicacion, id_equipo, id_usuario, estado } = req.body;

    try {
        // Guardar mantenimiento en la base de datos de equipos
        await query(
            'INSERT INTO Mantenimiento (tipo, descripcion_mantenimiento, fecha_mantenimiento, id_equipo, id_usuario, id_ubicacion, estado) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [tipo, descripcion_mantenimiento, fecha_mantenimiento, id_equipo, id_usuario, id_ubicacion, estado]
        );

        // Actualizar estado de la incidencia de equipos
        let nuevoEstado;

        switch (estado) {
            case 'completado':
                nuevoEstado = 'cerrada';
                break;
            case 'pendiente':
                nuevoEstado = 'en progreso';
                break;
            case 'cancelado':
                nuevoEstado = 'cancelada';
                break;
            default:
                nuevoEstado = 'abierta';
        }

        await query('UPDATE Incidencias SET estado = ? WHERE id_equipo = ?', [nuevoEstado, id_equipo]);

        // Redirigir o responder según corresponda de equipos
        res.redirect('/mantenimiento_equipos/listar');
    } catch (err) {
        console.error('Error al dar de alta el mantenimiento:', err);
        res.status(500).send('Error al procesar la solicitud');
    }
});

// Rutas para listar mantenimiento de equipos
app.get('/mantenimiento_equipos/listar', authMiddleware, roleMiddleware(['admin', 'tecnico']), async (req, res) => {
    const queryString = `
        SELECT m.id_mantenimiento, m.tipo, m.descripcion_mantenimiento, m.fecha_mantenimiento, 
               e.marca AS nombre_equipo, u.username AS nombre_usuario, 
               ubic.nombre_ubicacion, m.estado, m.fecha_creacion, m.fecha_modificacion, i.descripcion_incidencia
        FROM Mantenimiento m
        JOIN Equipos e ON m.id_equipo = e.id_equipo
        JOIN Usuarios u ON m.id_usuario = u.id
        JOIN Ubicaciones ubic ON m.id_ubicacion = ubic.id_ubicacion
        LEFT JOIN Incidencias i ON m.id_equipo = i.id_equipo
    `;

    try {
        const results = await query(queryString);

        // Obtener las ubicaciones para el filtro
        const ubicaciones = await query('SELECT * FROM Ubicaciones');
        
        // Pasar las ubicaciones junto con los resultados del mantenimiento
        res.render('equipos/mantenimiento_equipos_listar', {
            mantenimiento: results,
            ubicaciones: ubicaciones,
            messages: req.flash()
        });
    } catch (error) {
        console.error('Error al listar mantenimiento:', error);
        res.status(500).send('Error al procesar la solicitud');
    }
});

// Ruta para mostrar el formulario de actualización de mantenimiento de equipos
app.get('/mantenimiento_equipos/actualizar/:id_mantenimiento', authMiddleware, roleMiddleware(['admin', 'tecnico']), async (req, res) => {
    const { id_mantenimiento } = req.params;

    try {
        const mantenimiento = await query('SELECT * FROM Mantenimiento WHERE id_mantenimiento = ?', [id_mantenimiento]);
        
        // Verificar si se encontró el mantenimiento de equipos
        if (mantenimiento.length === 0) {
            return res.status(404).send('Mantenimiento no encontrado');
        }

        const equipos = await query('SELECT * FROM Equipos');
        const usuarios = await query('SELECT * FROM Usuarios');
        const ubicaciones = await query('SELECT * FROM Ubicaciones');

        res.render('equipos/mantenimiento_equipos_actualizar', {
            mantenimiento: mantenimiento[0],
            equipos,
            usuarios,
            ubicaciones
        });
    } catch (err) {
        console.error('Error al cargar el formulario de actualización de mantenimiento:', err);
        res.status(500).send('Error al procesar la solicitud');
    }
});

// Ruta para manejar la actualización de mantenimiento de equipos
app.post('/mantenimiento_equipos/actualizar/:id_mantenimiento', authMiddleware, roleMiddleware(['admin', 'tecnico']), async (req, res) => {
    const { tipo, descripcion_mantenimiento, fecha_mantenimiento, id_ubicacion, id_equipo, id_usuario, estado } = req.body;
    const { id_mantenimiento } = req.params;

    try {
        // Actualizar mantenimiento en la base de datos de equipos
        await query(
            'UPDATE Mantenimiento SET tipo = ?, descripcion_mantenimiento = ?, fecha_mantenimiento = ?, id_equipo = ?, id_usuario = ?, id_ubicacion = ?, estado = ? WHERE id_mantenimiento = ?',
            [tipo, descripcion_mantenimiento, fecha_mantenimiento, id_equipo, id_usuario, id_ubicacion, estado, id_mantenimiento]
        );

        // Actualizar estado de la incidencia de equipos
        let nuevoEstado;

        switch (estado) {
            case 'completado':
                nuevoEstado = 'cerrada';
                break;
            case 'pendiente':
                nuevoEstado = 'en progreso';
                break;
            case 'cancelado':
                nuevoEstado = 'cancelada';
                break;
            default:
                nuevoEstado = 'abierta';
        }

        await query('UPDATE Incidencias SET estado = ? WHERE id_equipo = ?', [nuevoEstado, id_equipo]);

        // Redirigir a la lista de mantenimiento de equipos
        res.redirect('/mantenimiento_equipos/listar');
    } catch (err) {
        console.error('Error al actualizar el mantenimiento:', err);
        res.status(500).send('Error al procesar la solicitud');
    }
});

// Eliminar mantenimiento de equipos
app.post('/mantenimiento_equipos/eliminar/:id_mantenimiento', authMiddleware, roleMiddleware(['admin', 'tecnico']), async (req, res) => {
    const idMantenimiento = req.params.id_mantenimiento;

    try {
        // Primero, eliminar la incidencia asociada al mantenimiento de equipos
        await query('DELETE FROM Incidencias WHERE id_equipo = (SELECT id_equipo FROM Mantenimiento WHERE id_mantenimiento = ?)', [idMantenimiento]);

        // Luego, eliminar el mantenimiento de equipos
        await query('DELETE FROM Mantenimiento WHERE id_mantenimiento = ?', [idMantenimiento]);

        // Agregar mensaje de éxito
        req.flash('success', 'Mantenimiento eliminado exitosamente');
        res.redirect('/mantenimiento_equipos/listar');
    } catch (error) {
        console.error('Error al eliminar el mantenimiento y su incidencia:', error);
        res.status(500).send('Error al eliminar mantenimiento e incidencia');
    }
});

// ==========================
// Incidencias Hardware
// ==========================

// Rutas para dar de alta incidencias de hardware
app.get('/incidencias_hardware/alta', authMiddleware, roleMiddleware(['admin', 'tecnico', 'usuario']), async (req, res) => {
    try {
        const hardware = await query('SELECT * FROM Hardware');
        const usuarios = await query('SELECT * FROM Usuarios');
        const ubicaciones = await query('SELECT * FROM Ubicaciones');
        res.render('hardware/incidencias_hardware', { hardware, usuarios, ubicaciones });
    } catch (err) {
        console.error('Error al cargar el formulario de alta de incidencias:', err);
        res.status(500).send('Error al procesar la solicitud');
    }
});

// Ruta para registrar una incidencia de hardware
app.post('/incidencias_hardware/alta', authMiddleware, roleMiddleware(['admin', 'tecnico', 'usuario']), (req, res) => {
    const { descripcion_incidencia, fecha_reporte, estado, prioridad, id_ubicacion, id_hardware, id_usuario } = req.body;

    const nuevaIncidencia = {
        descripcion_incidencia,
        fecha_reporte,
        estado,
        prioridad,
        id_ubicacion,
        id_hardware,
        id_usuario
    };

    // Inserta la nueva incidencia en la base de datos de hardware
    db.query('INSERT INTO Incidencias SET ?', nuevaIncidencia, (error, results) => {
        if (error) {
            return res.status(500).send('Error al registrar la incidencia');
        }
        res.redirect('/incidencias_hardware/listar');
    });
});

// Rutas para listar incidencias de hardware con filtros
app.get('/incidencias_hardware/listar', authMiddleware, roleMiddleware(['admin', 'tecnico', 'usuario']), async (req, res) => {
    const { fecha_reporte, estado, prioridad, id_ubicacion, fecha_creacion, fecha_modificacion } = req.query;

    let queryString = `
        SELECT 
            i.id_incidencia, 
            i.descripcion_incidencia, 
            i.fecha_reporte, 
            i.estado, 
            i.prioridad,
            i.fecha_creacion,
            i.fecha_modificacion, 
            h.marca AS nombre_hardware,
            u.username AS nombre_usuario, 
            loc.nombre_ubicacion
        FROM 
            Incidencias i
        JOIN 
            Ubicaciones loc ON i.id_ubicacion = loc.id_ubicacion
        JOIN 
            Usuarios u ON i.id_usuario = u.id
        JOIN 
            Hardware h ON i.id_hardware = h.id_hardware
        WHERE 1=1
    `;

    // Añadir filtros si existen
    const queryParams = [];
    
    if (fecha_reporte) {
        queryString += ` AND i.fecha_reporte >= ?`;
        queryParams.push(fecha_reporte);
    }

    if (estado) {
        queryString += ` AND i.estado = ?`;
        queryParams.push(estado);
    }

    if (prioridad) {
        queryString += ` AND i.prioridad = ?`;
        queryParams.push(prioridad);
    }

    if (id_ubicacion) {
        queryString += ` AND i.id_ubicacion = ?`;
        queryParams.push(id_ubicacion);
    }

    if (fecha_creacion) {
        queryString += ` AND i.fecha_creacion >= ?`;
        queryParams.push(fecha_creacion);
    }

    if (fecha_modificacion) {
        queryString += ` AND i.fecha_modificacion >= ?`;
        queryParams.push(fecha_modificacion);
    }

    try {
        // Obtener las incidencias y las ubicaciones
        const [results, ubicaciones] = await Promise.all([
            query(queryString, queryParams),
            query('SELECT id_ubicacion, nombre_ubicacion FROM Ubicaciones ORDER BY nombre_ubicacion')
        ]);

        res.render('hardware/incidencias_hardware_listar', {
            incidencias: results,
            messages: req.flash(),
            filters: req.query,
            ubicaciones: ubicaciones
        });
    } catch (err) {
        console.error('Error al listar incidencias:', err);
        res.status(500).send('Error al procesar la solicitud');
    }
});

// Ruta para mostrar el formulario de actualización de incidencias de hardware
app.get('/incidencias_hardware/actualizar/:id_incidencia', authMiddleware, roleMiddleware(['admin', 'tecnico', 'usuario']), async (req, res) => {
    const { id_incidencia } = req.params;

    try {
        const incidenciaResults = await query('SELECT * FROM Incidencias WHERE id_incidencia = ?', [id_incidencia]);
        const hardwareResults = await query('SELECT * FROM Hardware');
        const usuariosResults = await query('SELECT * FROM Usuarios');
        const ubicacionesResults = await query('SELECT * FROM Ubicaciones');

        res.render('hardware/incidencias_hardware_actualizar', {
            incidencia: incidenciaResults[0],
            hardware: hardwareResults,
            usuarios: usuariosResults,
            ubicaciones: ubicacionesResults
        });
    } catch (err) {
        console.error('Error al cargar el formulario de actualización de incidencias:', err);
        res.status(500).send('Error al procesar la solicitud');
    }
});

// Ruta para manejar la actualización de incidencias de hardware
app.post('/incidencias_hardware/actualizar/:id_incidencia', authMiddleware, roleMiddleware(['admin', 'tecnico', 'usuario']), async (req, res) => {
    const { descripcion_incidencia, fecha_reporte, estado, prioridad, id_hardware, id_usuario, id_ubicacion } = req.body;
    const { id_incidencia } = req.params;

    try {
        await query(
            'UPDATE Incidencias SET descripcion_incidencia = ?, fecha_reporte = ?, estado = ?, prioridad = ?, id_hardware = ?, id_usuario = ?, id_ubicacion = ? WHERE id_incidencia = ?',
            [descripcion_incidencia, fecha_reporte, estado, prioridad, id_hardware, id_usuario, id_ubicacion, id_incidencia]
        );
        res.redirect('/incidencias_hardware/listar');
    } catch (err) {
        console.error('Error al actualizar la incidencia:', err);
        res.status(500).send('Error al procesar la solicitud');
    }
});

// Eliminar incidencia de hardware
app.post('/incidencias_hardware/eliminar/:id', authMiddleware, roleMiddleware(['admin', 'tecnico', 'usuario']), async (req, res) => {
    const idIncidencia = req.params.id;
    
    try {
        // Primero, eliminar el mantenimiento asociado a la incidencia de hardware
        await query('DELETE FROM Mantenimiento WHERE id_hardware = (SELECT id_hardware FROM Incidencias WHERE id_incidencia = ?)', [idIncidencia]);

        // Luego, eliminar la incidencia de hardware
        await query('DELETE FROM Incidencias WHERE id_incidencia = ?', [idIncidencia]);

        // Agregar mensaje de éxito
        req.flash('success', 'Incidencia eliminada exitosamente');
        res.redirect('/incidencias_hardware/listar');
    } catch (error) {
        console.error('Error al eliminar la incidencia y su mantenimiento:', error);
        res.status(500).send('Error al eliminar incidencia y mantenimiento');
    }
});

// Ruta para obtener hardware por ubicación 
app.get('/hardware/ubicacion/:idUbicacion', authMiddleware, roleMiddleware(['admin', 'tecnico', 'usuario']), async (req, res) => {
    const { idUbicacion } = req.params;
    try {
        const hardware = await query('SELECT * FROM Hardware WHERE id_ubicacion = ?', [idUbicacion]);
        res.json(hardware);
    } catch (err) {
        console.error('Error al obtener el hardware:', err);
        res.status(500).json({ error: 'Error al obtener el hardware' });
    }
});

// ==========================
// Mantenimiento Hardware
// ==========================

// Rutas para dar de alta mantenimiento de hardware
app.get('/mantenimiento_hardware/alta', authMiddleware, roleMiddleware(['admin', 'tecnico']), async (req, res) => {
    try {
        const hardware = await query('SELECT * FROM Hardware');
        const usuarios = await query('SELECT * FROM Usuarios');
        const ubicaciones = await query('SELECT * FROM Ubicaciones');
        res.render('hardware/mantenimiento_hardware', { hardware, usuarios, ubicaciones });
    } catch (err) {
        console.error('Error al cargar el formulario de alta de mantenimiento:', err);
        res.status(500).send('Error al procesar la solicitud');
    }
});

// Ruta para dar de alta mantenimiento de hardware
app.post('/mantenimiento_hardware/alta', authMiddleware, roleMiddleware(['admin', 'tecnico']), async (req, res) => {
    const { tipo, descripcion_mantenimiento, fecha_mantenimiento, id_ubicacion, id_hardware, id_usuario, estado } = req.body;

    try {
        // Guardar mantenimiento en la base de datos de hardware
        await query(
            'INSERT INTO Mantenimiento (tipo, descripcion_mantenimiento, fecha_mantenimiento, id_hardware, id_usuario, id_ubicacion, estado) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [tipo, descripcion_mantenimiento, fecha_mantenimiento, id_hardware, id_usuario, id_ubicacion, estado]
        );

        // Actualizar estado de la incidencia de hardware
        let nuevoEstado;

        switch (estado) {
            case 'completado':
                nuevoEstado = 'cerrada';
                break;
            case 'pendiente':
                nuevoEstado = 'en progreso';
                break;
            case 'cancelado':
                nuevoEstado = 'cancelada';
                break;
            default:
                nuevoEstado = 'abierta';
        }

        await query('UPDATE Incidencias SET estado = ? WHERE id_hardware = ?', [nuevoEstado, id_hardware]);

        // Redirigir o responder según corresponda de hardware
        res.redirect('/mantenimiento_hardware/listar');
    } catch (err) {
        console.error('Error al dar de alta el mantenimiento:', err);
        res.status(500).send('Error al procesar la solicitud');
    }
});

// Rutas para listar mantenimiento de hardware
app.get('/mantenimiento_hardware/listar', authMiddleware, roleMiddleware(['admin', 'tecnico']), async (req, res) => {
    const queryString = `
        SELECT m.id_mantenimiento, m.tipo, m.descripcion_mantenimiento, m.fecha_mantenimiento, 
               h.marca AS nombre_hardware, u.username AS nombre_usuario, 
               ubic.nombre_ubicacion, m.estado, m.fecha_creacion, m.fecha_modificacion, i.descripcion_incidencia
        FROM Mantenimiento m
        JOIN Hardware h ON m.id_hardware = h.id_hardware
        JOIN Usuarios u ON m.id_usuario = u.id
        JOIN Ubicaciones ubic ON m.id_ubicacion = ubic.id_ubicacion
        LEFT JOIN Incidencias i ON m.id_hardware = i.id_hardware
    `;
    
    try {
        const mantenimientoResults = await query(queryString);
        const ubicaciones = await query('SELECT * FROM Ubicaciones');

        // Pasar tanto el mantenimiento como las ubicaciones a la vista
        res.render('hardware/mantenimiento_hardware_listar', { 
            mantenimiento: mantenimientoResults, 
            ubicaciones: ubicaciones,
            messages: req.flash() 
        });
    } catch (error) {
        console.error('Error al listar mantenimiento:', error);
        res.status(500).send('Error al procesar la solicitud');
    }
});

// Ruta para mostrar el formulario de actualización de mantenimiento de hardware
app.get('/mantenimiento_hardware/actualizar/:id_mantenimiento', authMiddleware, roleMiddleware(['admin', 'tecnico']), async (req, res) => {
    const { id_mantenimiento } = req.params;

    try {
        const mantenimiento = await query('SELECT * FROM Mantenimiento WHERE id_mantenimiento = ?', [id_mantenimiento]);
        
        // Verificar si se encontró el mantenimiento de hardware
        if (mantenimiento.length === 0) {
            return res.status(404).send('Mantenimiento no encontrado');
        }

        const hardware = await query('SELECT * FROM Hardware');
        const usuarios = await query('SELECT * FROM Usuarios');
        const ubicaciones = await query('SELECT * FROM Ubicaciones');

        res.render('hardware/mantenimiento_hardware_actualizar', {
            mantenimiento: mantenimiento[0],
            hardware,
            usuarios,
            ubicaciones
        });
    } catch (err) {
        console.error('Error al cargar el formulario de actualización de mantenimiento:', err);
        res.status(500).send('Error al procesar la solicitud');
    }
});

// Ruta para manejar la actualización de mantenimiento de hardware
app.post('/mantenimiento_hardware/actualizar/:id_mantenimiento', authMiddleware, roleMiddleware(['admin', 'tecnico']), async (req, res) => {
    const { tipo, descripcion_mantenimiento, fecha_mantenimiento, id_ubicacion, id_hardware, id_usuario, estado } = req.body;
    const { id_mantenimiento } = req.params;

    try {
        // Actualizar mantenimiento en la base de datos de hardware
        await query(
            'UPDATE Mantenimiento SET tipo = ?, descripcion_mantenimiento = ?, fecha_mantenimiento = ?, id_hardware = ?, id_usuario = ?, id_ubicacion = ?, estado = ? WHERE id_mantenimiento = ?',
            [tipo, descripcion_mantenimiento, fecha_mantenimiento, id_hardware, id_usuario, id_ubicacion, estado, id_mantenimiento]
        );

        // Actualizar estado de la incidencia de hardware
        let nuevoEstado;

        switch (estado) {
            case 'completado':
                nuevoEstado = 'cerrada';
                break;
            case 'pendiente':
                nuevoEstado = 'en progreso';
                break;
            case 'cancelado':
                nuevoEstado = 'cancelada';
                break;
            default:
                nuevoEstado = 'abierta';
        }

        await query('UPDATE Incidencias SET estado = ? WHERE id_hardware = ?', [nuevoEstado, id_hardware]);

        // Redirigir a la lista de mantenimiento de hardware
        res.redirect('/mantenimiento_hardware/listar');
    } catch (err) {
        console.error('Error al actualizar el mantenimiento:', err);
        res.status(500).send('Error al procesar la solicitud');
    }
});

// Eliminar mantenimiento de hardware
app.post('/mantenimiento_hardware/eliminar/:id_mantenimiento', authMiddleware, roleMiddleware(['admin', 'tecnico']), async (req, res) => {
    const idMantenimiento = req.params.id_mantenimiento;

    try {
        // Primero, eliminar la incidencia asociada al mantenimiento de hardware
        await query('DELETE FROM Incidencias WHERE id_hardware = (SELECT id_hardware FROM Mantenimiento WHERE id_mantenimiento = ?)', [idMantenimiento]);

        // Luego, eliminar el mantenimiento de hardware
        await query('DELETE FROM Mantenimiento WHERE id_mantenimiento = ?', [idMantenimiento]);

        // Agregar mensaje de éxito
        req.flash('success', 'Mantenimiento eliminado exitosamente');
        res.redirect('/mantenimiento_hardware/listar');
    } catch (error) {
        console.error('Error al eliminar el mantenimiento y su incidencia:', error);
        res.status(500).send('Error al eliminar mantenimiento e incidencia');
    }
});

// ==========================
// Ubicaciones
// ==========================

// Rutas para dar de alta ubicaciones
app.get('/ubicaciones/alta', authMiddleware, roleMiddleware(['admin', 'tecnico']), (req, res) => {
    res.render('ubicaciones/ubicaciones');
});

// Ruta para manejar el alta de ubicaciones
app.post('/ubicaciones/alta', authMiddleware, roleMiddleware(['admin', 'tecnico']), (req, res) => {
    const { nombre_ubicacion, departamento_responsable } = req.body;
    db.query(
        'INSERT INTO Ubicaciones (nombre_ubicacion, departamento_responsable) VALUES (?, ?)',
        [nombre_ubicacion, departamento_responsable],
        (err, result) => {
            if (err) {
                console.error('Error al dar de alta la ubicación:', err);
                return res.status(500).send('Error al dar de alta la ubicación');
            }
            res.redirect('/ubicaciones/listar');
        }
    );
});

// Rutas para listar ubicaciones
app.get('/ubicaciones/listar', authMiddleware, roleMiddleware(['admin', 'tecnico', 'usuario']), (req, res) => {
    db.query('SELECT * FROM Ubicaciones', (err, results) => {
        if (err) throw err;
        res.render('ubicaciones/ubicaciones_listar', { ubicaciones: results, messages: req.flash() });
    });
});

// Ruta para mostrar el formulario de actualización de ubicaciones
app.get('/ubicaciones/actualizar/:id_ubicacion', authMiddleware, roleMiddleware(['admin', 'tecnico']), (req, res) => {
    const { id_ubicacion } = req.params;
    db.query('SELECT * FROM Ubicaciones WHERE id_ubicacion = ?', [id_ubicacion], (err, results) => {
        if (err) throw err;
        res.render('ubicaciones/ubicaciones_actualizar', { ubicacion: results[0] });
    });
});

// Ruta para manejar la actualización de ubicaciones
app.post('/ubicaciones/actualizar/:id_ubicacion', authMiddleware, roleMiddleware(['admin', 'tecnico']), (req, res) => {
    const { nombre_ubicacion, departamento_responsable } = req.body;
    const { id_ubicacion } = req.params;
    db.query(
        'UPDATE Ubicaciones SET nombre_ubicacion = ?, departamento_responsable = ? WHERE id_ubicacion = ?',
        [nombre_ubicacion, departamento_responsable, id_ubicacion],
        (err, result) => {
            if (err) throw err;
            res.redirect('/ubicaciones/listar');
        }
    );
});

// Eliminar ubicación
app.post('/ubicaciones/eliminar/:id_ubicacion', authMiddleware, roleMiddleware(['admin', 'tecnico']), (req, res) => {
    const { id_ubicacion } = req.params;
    db.query('DELETE FROM Ubicaciones WHERE id_ubicacion = ?', [id_ubicacion], (err, result) => {
        if (err) throw err;
        res.redirect('/ubicaciones/listar');
    });
});

// Eliminar ubicación y registros asociados
app.post('/ubicaciones/eliminar/:id_ubicacion', authMiddleware, roleMiddleware(['admin', 'tecnico']), async (req, res) => {
    const { id_ubicacion } = req.params;

    try {
        // Eliminar equipos asociados
        await query('DELETE FROM Equipos WHERE id_ubicacion = ?', [id_ubicacion]);

        // Eliminar incidencias asociadas
        await query('DELETE FROM Incidencias WHERE id_ubicacion = ?', [id_ubicacion]);

        // Eliminar mantenimientos asociados
        await query('DELETE FROM Mantenimiento WHERE id_ubicacion = ?', [id_ubicacion]);

        // Finalmente, eliminar la ubicación
        await query('DELETE FROM Ubicaciones WHERE id_ubicacion = ?', [id_ubicacion]);

        // Agregar mensaje de éxito
        req.flash('success', 'Ubicación eliminada exitosamente');
        res.redirect('/ubicaciones/listar');

    } catch (error) {
        console.error('Error al eliminar la ubicación y registros asociados:', error);
        return res.status(500).send('Error al eliminar la ubicación y registros asociados');
    }
});

// Funciones para obtener equipos y hardware por ubicación
async function obtenerEquiposPorUbicacion(idUbicacion) {
    return new Promise((resolve, reject) => {
        db.query('SELECT * FROM Equipos WHERE id_ubicacion = ?', [idUbicacion], (err, results) => {
            if (err) return reject(err);
            resolve(results);
        });
    });
}

async function obtenerHardwarePorUbicacion(idUbicacion) {
    return new Promise((resolve, reject) => {
        db.query('SELECT * FROM Hardware WHERE id_ubicacion = ?', [idUbicacion], (err, results) => {
            if (err) return reject(err);
            resolve(results);
        });
    });
}

// Obtener los equipos únicos según la ubicación
app.get('/equipos/ubicacion/:idUbicacion', authMiddleware, roleMiddleware(['admin', 'tecnico']), (req, res) => {
    const idUbicacion = req.params.idUbicacion;
    const equipos = obtenerEquiposPorUbicacion(idUbicacion);
    res.json(equipos);
});

// Obtener el hardware único según la ubicación
app.get('/hardware/ubicacion/:idUbicacion', authMiddleware, roleMiddleware(['admin', 'tecnico']), (req, res) => {
    const idUbicacion = req.params.idUbicacion;
    const hardware = obtenerHardwarePorUbicacion(idUbicacion);
    res.json(hardware);
});

// Ruta para obtener equipos por ubicación
app.get('/equipos/ubicacion/:id_ubicacion', authMiddleware, roleMiddleware(['admin', 'tecnico']), (req, res) => {
    const { id_ubicacion } = req.params;
    
    db.query('SELECT * FROM Equipos WHERE id_ubicacion = ?', [id_ubicacion], (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});

// Ruta para obtener hardware por ubicación
app.get('/ubicaciones/:id/hardware', authMiddleware, roleMiddleware(['admin', 'tecnico']), (req, res) => {
    const ubicacionId = req.params.id;
    db.query('SELECT * FROM hardware WHERE id_ubicacion = ?', [ubicacionId], (error, resultados) => {
        if (error) {
            console.error('Error al obtener el hardware:', error);
            return res.status(500).json({ error: 'Error al obtener el hardware' });
        }
        res.json(resultados);
    });
});

app.get('/ubicaciones/:id/equipos', authMiddleware, roleMiddleware(['admin', 'tecnico']), (req, res) => {
    const ubicacionId = req.params.id;
    db.query('SELECT * FROM equipos WHERE id_ubicacion = ?', [ubicacionId], (error, resultados) => {
        if (error) {
            console.error('Error al obtener los equipos:', error);
            return res.status(500).json({ error: 'Error al obtener los equipos' });
        }
        res.json(resultados);
    });
});

// ==========================
// Usuarios
// ==========================

// Rutas para dar de alta usuarios
app.get('/usuarios/alta', authMiddleware, roleMiddleware(['admin']), (req, res) => {
    res.render('usuarios/usuarios');
});

app.post('/usuarios/alta', authMiddleware, roleMiddleware(['admin']), (req, res) => {
    const { username, email, password, rol } = req.body;
    db.query('INSERT INTO Usuarios (username, email, password, rol) VALUES (?, ?, ?, ?)', [username, email, password, rol], (err, results) => {
        if (err) throw err;
        res.redirect('/usuarios/listar');
    });
});

// Rutas para listar usuarios
app.get('/usuarios/listar', authMiddleware, roleMiddleware(['admin']), (req, res) => {
    db.query('SELECT * FROM Usuarios', (err, results) => {
        if (err) throw err;
        res.render('usuarios/usuarios_listar', { usuarios: results });
    });
});

// Ruta para mostrar el formulario de actualización de usuarios
app.get('/usuarios/actualizar/:id', authMiddleware, roleMiddleware(['admin']), (req, res) => {
    const { id } = req.params;
    db.query('SELECT * FROM Usuarios WHERE id = ?', [id], (err, results) => {
        if (err) throw err;
        res.render('usuarios/usuarios_actualizar', { usuario: results[0] });
    });
});

// Ruta para manejar la actualización de usuarios
app.post('/usuarios/actualizar/:id', authMiddleware, roleMiddleware(['admin']), (req, res) => {
    const { username, email, rol } = req.body;
    const { id } = req.params;
    db.query(
        'UPDATE Usuarios SET username = ?, email = ?, rol = ? WHERE id = ?',
        [username, email, rol, id],
        (err, result) => {
            if (err) throw err;
            res.redirect('/usuarios/listar');
        }
    );
});

// Eliminar usuario
app.post('/usuarios/eliminar/:id', authMiddleware, roleMiddleware(['admin']), (req, res) => {
    const { id } = req.params;
    db.query('DELETE FROM Usuarios WHERE id = ?', [id], (err, result) => {
        if (err) throw err;
        res.redirect('/usuarios/listar');
    });
});

// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});
