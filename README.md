# CheckIT — Sistema de Control de Equipos de Cómputo

**CheckIT** es una solución de software diseñada para gestionar el acceso, la trazabilidad y la seguridad de los equipos de cómputo y dispositivos electrónicos mediante el registro de usuarios, autenticación, control de roles y seguimiento en tiempo real de los movimientos.

---

## 📄 Descripción

CheckIT permite administrar de manera eficiente la entrada y salida de equipos tecnológicos dentro de una institución u organización, garantizando un control estricto de permisos y la persistencia de datos seguros para auditoría.

---

## 📁 Estructura del Repositorio

El proyecto cuenta con la documentación general, esquemas de base de datos e histórico de versiones del desarrollo:

* **`CheckIT/`**: Versión principal del proyecto.
* **`checkit_v1/`, `checkit_v2/`, `checkit_v3/`, `checkit_v4/`**: Módulos e historial de iteraciones del desarrollo.
* **`database/`**: Scripts SQL, esquemas relacionales y consultas para la base de datos.
* **`docs/`**: Diccionario de datos y documentación técnica del sistema.
* **`test/`**: Pruebas de integración, consultas y scripts de prueba.

---

## ⚙️ Funcionalidades Principales

* **Autenticación y Sesión:** Registro e inicio de sesión seguro para los usuarios.
* **Gestión de Usuarios y Roles:** Control de acceso granular por rol (Administrador, Usuario, Guarda de Seguridad, etc.).
* **Control de Equipos:** Registro detallado y seguimiento en tiempo real de la entrada y salida de dispositivos.
* **Mapeo de Base de Datos:** Scripts automatizados de estructura e inserción de datos operativos.

---

## 🛠️ Tecnologías Utilizadas

### **Frontend**
* **React**: Librería principal para la construcción de la interfaz de usuario basada en componentes.
* **Vite**: Bundler y entorno de desarrollo rápido.
* **Tailwind CSS**: Framework de CSS para el diseño responsivo, estilización por clases de utilidad y componentes modulares.
* **Lucide React**: Biblioteca de iconos vectoriales limpios y modernos.
* **jsPDF & autoTable**: Generación dinámicas de reportes y exportación de datos en formato PDF en el cliente.

### **Backend**
* **Node.js**: Entorno de ejecución para el servidor en JavaScript.
* **Express.js**: Framework para la creación de la API RESTful y gestión de rutas.
* **Cors**: Middleware para la habilitación de peticiones entre dominios cruzados.

### **Base de Datos & Gestión de Estado**
* **SQLite / MySQL**: Motor de base de datos relacional para el almacenamiento de registros de entrada/salida, equipos y personas.
* **Axios / Client API**: Cliente HTTP para consumir los endpoints del servidor en tiempo real.

---

## 👤 Autor / Equipo TECNOSOFT

Desarrollado con dedicación por:
* **Anyi**
* **Emerson**
* **Doly**
* **Santiago**
