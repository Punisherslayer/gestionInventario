-- Active: 1709076538870@@127.0.0.1@3306
CREATE DATABASE IF NOT EXISTS gestioninventario;
USE gestioninventario;

-- Tabla de Usuarios
CREATE TABLE IF NOT EXISTS Usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL, 
    rol ENUM('admin', 'tecnico', 'usuario') NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    fecha_ultimo_acceso DATETIME DEFAULT NULL
);

-- Tabla de Ubicaciones
CREATE TABLE IF NOT EXISTS Ubicaciones (
    id_ubicacion INT AUTO_INCREMENT PRIMARY KEY,
    nombre_ubicacion VARCHAR(100) NOT NULL UNIQUE,
    departamento_responsable VARCHAR(50)
);

-- Insertar ubicaciones
INSERT INTO Ubicaciones (nombre_ubicacion, departamento_responsable) VALUES
('B2', 'Departamento Informática'),
('S1', 'Departamento Informática'),
('S2', 'Departamento Informática'),
('S3', 'Departamento Informática'),
('S4', 'Departamento Informática'),
('S5', 'Departamento Informática'),
('Sala de Profesores', 'Departamento Informática');

-- Tabla de Equipos
CREATE TABLE IF NOT EXISTS Equipos (
    id_equipo INT AUTO_INCREMENT PRIMARY KEY,
    tipo ENUM('PC', 'Laptop', 'Impresora', 'Otro') NOT NULL,
    marca VARCHAR(50),
    modelo VARCHAR(50),
    sistema_operativo ENUM('Windows', 'Linux', 'macOS ', 'Otro') NOT NULL,
    placa_base VARCHAR(50),
    procesador VARCHAR(50),
    memoria_ram VARCHAR(50),
    disco_duro VARCHAR(50),
    tarjeta_grafica VARCHAR(50),
    sistema_refrigeracion ENUM('si', 'no'),
    unidad_optica ENUM('si', 'no'),
    tarjeta_sonido ENUM('si', 'no'),
    tarjeta_red ENUM('si', 'no'),
    teclado ENUM('si', 'no'),
    raton ENUM('si', 'no'),
    monitor ENUM('si', 'no'),
    altavoces ENUM('si', 'no'),
    cables_conectores VARCHAR(200),
    id_ubicacion INT,
    estado ENUM('activo', 'en reparación', 'obsoleto') NOT NULL,
    fecha_asignacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id_ubicacion) REFERENCES Ubicaciones(id_ubicacion) ON DELETE CASCADE
);

-- Tabla de Hardware
CREATE TABLE IF NOT EXISTS Hardware (
    id_hardware INT AUTO_INCREMENT PRIMARY KEY,
    tipo_componente ENUM('Procesador', 'RAM', 'Disco_Duro', 'Tarjeta_Grafica', 'Fuente_Alimentacion', 'Otro') NOT NULL,
    marca VARCHAR(50),
    modelo VARCHAR(50),
    especificaciones TEXT,
    estado ENUM('disponible', 'en uso', 'en reparación', 'desechado') NOT NULL,
    id_ubicacion INT,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id_ubicacion) REFERENCES Ubicaciones(id_ubicacion) ON DELETE CASCADE
);

-- Tabla de Software
CREATE TABLE Software (
    id_software INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    version VARCHAR(20) NOT NULL,
    fecha_vencimiento DATE,
    detalles_licencia VARCHAR(100) NOT NULL,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabla de Incidencias
CREATE TABLE IF NOT EXISTS Incidencias (
    id_incidencia INT AUTO_INCREMENT PRIMARY KEY,
    descripcion_incidencia VARCHAR(200) NOT NULL,
    fecha_reporte DATETIME NOT NULL,
    estado ENUM('abierta', 'en progreso', 'cerrada', 'cancelada') DEFAULT 'abierta',
    prioridad ENUM('baja', 'media', 'alta') DEFAULT 'media',
    id_equipo INT,
    id_hardware INT,
    id_ubicacion INT,
    id_usuario INT,
    FOREIGN KEY (id_equipo) REFERENCES Equipos(id_equipo) ON DELETE CASCADE,
    FOREIGN KEY (id_hardware) REFERENCES Hardware(id_hardware) ON DELETE CASCADE,
    FOREIGN KEY (id_ubicacion) REFERENCES Ubicaciones(id_ubicacion) ON DELETE CASCADE,
    FOREIGN KEY (id_usuario) REFERENCES Usuarios(id) ON DELETE NO ACTION,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabla de Mantenimiento
CREATE TABLE IF NOT EXISTS Mantenimiento (
    id_mantenimiento INT AUTO_INCREMENT PRIMARY KEY,
    tipo ENUM('preventivo', 'correctivo') NOT NULL,
    descripcion_mantenimiento TEXT NOT NULL,
    fecha_mantenimiento DATETIME NOT NULL,
    id_incidencia INT,
    id_equipo INT,
    id_hardware INT,
    id_usuario INT,
    id_ubicacion INT,
    estado ENUM('completado', 'pendiente', 'cancelado') DEFAULT 'pendiente',
    fecha_cierre TIMESTAMP NULL,
    FOREIGN KEY (id_incidencia) REFERENCES Incidencias(id_incidencia) ON DELETE CASCADE,
    FOREIGN KEY (id_equipo) REFERENCES Equipos(id_equipo) ON DELETE CASCADE,
    FOREIGN KEY (id_hardware) REFERENCES Hardware(id_hardware) ON DELETE CASCADE,
    FOREIGN KEY (id_ubicacion) REFERENCES Ubicaciones(id_ubicacion) ON DELETE CASCADE,
    FOREIGN KEY (id_usuario) REFERENCES Usuarios(id) ON DELETE NO ACTION,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Índices adicionales para mejorar el rendimiento
CREATE INDEX idx_usuarios_rol ON Usuarios(rol);
CREATE INDEX idx_usuarios_email ON Usuarios(email);
CREATE INDEX idx_ubicaciones_departamento ON Ubicaciones(departamento_responsable);
CREATE INDEX idx_equipos_estado ON Equipos(estado);
CREATE INDEX idx_equipos_id_ubicacion ON Equipos(id_ubicacion);
CREATE INDEX idx_equipos_ubicacion_estado ON Equipos(id_ubicacion, estado);
CREATE INDEX idx_hardware_estado ON Hardware(estado);
CREATE INDEX idx_hardware_id_ubicacion ON Hardware(id_ubicacion);
CREATE INDEX idx_hardware_tipo_componente ON Hardware(tipo_componente);
CREATE INDEX idx_software_fecha_vencimiento ON Software(fecha_vencimiento);
CREATE INDEX idx_incidencias_fecha_reporte ON Incidencias(fecha_reporte);
CREATE INDEX idx_incidencias_id_equipo ON Incidencias(id_equipo);
CREATE INDEX idx_incidencias_ubicacion_usuario ON Incidencias(id_ubicacion, id_usuario);
CREATE INDEX idx_mantenimiento_fecha_mantenimiento ON Mantenimiento(fecha_mantenimiento);
CREATE INDEX idx_mantenimiento_id_equipo ON Mantenimiento(id_equipo);
CREATE INDEX idx_mantenimiento_estado_usuario ON Mantenimiento(estado, id_usuario);
