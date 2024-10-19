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

---

### Explicación de cada sección:

- **Descripción**: Breve resumen sobre qué es el proyecto.
- **Requisitos**: Herramientas necesarias para ejecutar el proyecto (Node.js, MySQL, etc.).
- **Instalación**: Pasos detallados para clonar el repositorio, instalar dependencias, configurar variables de entorno y base de datos.
- **Uso**: Instrucciones para ejecutar la aplicación localmente.
- **Estructura del Proyecto**: Descripción breve de la organización de carpetas y archivos del proyecto.
- **Contribución**: Guía sobre cómo otros desarrolladores pueden contribuir al proyecto.
- **Licencia**: Información legal sobre la licencia del proyecto (en este caso, MIT).

Este `README.md` proporciona instrucciones claras para cualquier persona que quiera clonar tu proyecto, ejecutarlo localmente y contribuir.


