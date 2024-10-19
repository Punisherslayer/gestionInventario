# Gestión de Inventario - IES Ntra. Sra. de la Victoria de Lepanto

## Descripción

Este proyecto es una **aplicación web** para gestionar de manera integral el **equipamiento, hardware, software y ubicaciones** de un centro educativo. Permite dar de alta, actualizar, listar y eliminar equipos, hardware, software, incidencias, mantenimiento, usuarios y ubicaciones.

## Requisitos

Para ejecutar este proyecto, necesitarás tener instalado lo siguiente:

- [Node.js](https://nodejs.org/es/) (Recomendado: versión LTS)
- [MySQL](https://www.mysql.com/downloads/)
- Un editor de texto como [Visual Studio Code](https://code.visualstudio.com/)

## Instalación

1. **Clonar el repositorio**:
   ```bash
   git clone https://github.com/tu-usuario/gestion-inventario.git

2. **Acceder a la carpeta del proyecto**:
    cd gestionInventario

3. **Instalar las dependencias**:
    npm install

4. **Configurar las variables de entorno**:
    En el fichero .env

    DB_HOST=localhost
    DB_USER=tu_usuario
    DB_PASSWORD=tu_contraseña
    DB_NAME=gestioninventario
    SESSION_SECRET=tu_secreto

5. **Configurar la base de datos**:
    Importa la estructura de la base de datos desde el archivo sql en tu servidor MySQL.

## Uso

1. **Iniciar el servidor**:
    npm start o npm run dev

2. **Acceder a la aplicación**:
    http://localhost:3000

## Estructura del Proyecto

GESTIONINVENTARIO
│
├── public/
│   ├── css/                  # Archivos CSS
│   ├── img/                  # Imágenes
│   └── sql/                  # Base de datos inventario.sql (no incluida)
│
├── views/                    # Plantillas EJS (vistas)
│   ├── equipos/
│   ├── hardware/
│   ├── software/
│   ├── ubicaciones/
│   └── usuarios/
│
├── uploads/                  # Directorio para archivos subidos (no incluida)
├── .env                      # Archivo de variables de entorno
├── app.js                    # Configuración principal del servidor
└── package.json              # Información de dependencias

## Contribución

1. **Haz un fork del repositorio.**
2. **Clona tu fork**:
    git clone https://github.com/tu-usuario/gestioninventario.git

3. **Crea una rama para tu funcionalidad**:
    git checkout -b nombre-de-tu-rama

4. **Realiza tus cambios y haz commit**:
    git add .
    git commit -m "Descripción de los cambios"

5. **Haz push de tu rama**:
    git push origin nombre-de-tu-rama
6. **Abre un pull request en el repositorio original.**

## Licencia

Este proyecto está bajo la licencia MIT. Para más detalles, consulta el archivo `LICENSE`.

## Notas Adicionales

Usuarios y Roles: El sistema cuenta con diferentes roles para usuarios, como administrador y usuario estándar. El administrador tiene acceso completo a todas las funcionalidades, mientras que los usuarios estándar tienen un acceso limitado a las acciones de consulta y gestión de su propio perfil.

Importación de Datos: El proyecto soporta la importación de datos a través de archivos CSV y XLS para el alta masiva de equipos, lo que permite agilizar la incorporación de información al sistema.

Seguridad: Se implementa autenticación mediante sesiones y encriptación de contraseñas usando la librería bcrypt. Además, las rutas están protegidas con middleware de autorización que verifica los roles de los usuarios.

Compatibilidad Móvil: La aplicación tiene un diseño responsivo básico, que permite su uso en dispositivos móviles. Aún se pueden realizar mejoras para optimizar la experiencia móvil.

Archivos no incluidos: Los archivos necesarios para la base de datos (inventario.sql) y la carga de archivos (uploads/) deben ser creados o configurados manualmente antes de ejecutar el sistema. Asegúrate de tener el entorno adecuado para la base de datos.

Dependencias y Módulos: Este proyecto utiliza módulos populares de Node.js como express, mysql2, multer, xlsx, entre otros. Es importante asegurarse de que todas las dependencias estén correctamente instaladas y actualizadas para el buen funcionamiento de la aplicación.

Modificaciones Futuras: Está planificado mejorar la interfaz móvil, optimizar la carga de grandes cantidades de datos y añadir nuevas funcionalidades como la exportación de inventario a formatos como PDF o Excel.
