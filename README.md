# Essence App 🌿

Aplicación fullstack para landing page de productos de belleza natural.

> **⚠️ RAMA DE PRODUCCIÓN** - Para desarrollo, cambia a la rama `dev`:
> ```bash
> git checkout dev
> ```

## 📁 Estructura del Proyecto

```
essence-app/
├── client/          # Frontend React + Vite + Tailwind
├── server/          # Backend Node.js + Express + MongoDB
├── package.json     # Scripts para ejecutar todo
└── README.md
```

## 🚀 Inicio Rápido

### 1️⃣ Instalar todas las dependencias

```bash
npm run install-all
```

### 2️⃣ Configurar variables de entorno

```bash
# En /server crear archivo .env
cd server
cp .env.example .env
# Editar .env con tus credenciales de MongoDB
```

### 3️⃣ Ejecutar en desarrollo

```bash
# Desde la raíz del proyecto
npm run dev
```

Esto iniciará:

- 🎨 Frontend en `http://localhost:5173`
- 🔧 Backend en `http://localhost:5000`

## 📦 Scripts Disponibles

```bash
npm run dev           # Ejecutar cliente y servidor simultáneamente
npm run client        # Solo frontend
npm run server        # Solo backend
npm run install-all   # Instalar todas las dependencias
npm run build         # Build de producción del cliente
```

## 🛠️ Tecnologías

### Frontend

- React 18
- TypeScript
- Vite
- Tailwind CSS

### Backend

- Node.js
- Express
- MongoDB + Mongoose
- JWT Authentication
- Imágenes en Base64 (MongoDB)

## ✨ Funcionalidades Clave

- Autenticación segura con JWT y flujo de administrador
- Dashboard privado con métricas y estado general del catálogo
- Gestión completa de productos (listar, crear, editar, eliminar)
- Subida de imágenes optimizada con Cloudinary y reemplazo controlado
- Formularios con validaciones básicas y previsualización de contenido

## 📚 Documentación

- [Frontend README](./client/README.md)
- [Backend README](./server/README.md)

## 🔐 Variables de Entorno

Crea un archivo `.env` en `/server` con:

```env
MONGO_URI=mongodb://localhost:27017/essence
PORT=5000
JWT_SECRET=tu_secreto_super_seguro
NODE_ENV=development
```

Para el cliente (opcional), puedes definir `VITE_API_URL` si deseas apuntar a otra URL para el backend:

```bash
# client/.env
VITE_API_URL=http://localhost:5000/api
```

## 🗄️ Base de Datos

### MongoDB Local

```bash
# Instalar MongoDB
# Windows: https://www.mongodb.com/try/download/community

# Iniciar MongoDB
mongod
```

### MongoDB Atlas (Recomendado)

1. Crear cuenta en [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Crear un cluster gratuito
3. Obtener la cadena de conexión
4. Actualizar `MONGO_URI` en `.env`

## 📝 Próximos Pasos

1. ✅ Estructura del proyecto creada
2. ✅ Backend configurado
3. ✅ Conectar frontend con backend
4. ✅ Implementar autenticación
5. ✅ Crear sistema de productos
6. ✅ Subir imágenes a Cloudinary
7. ⏳ Deploy a producción

## 🤝 Contribuir

Este es un proyecto personal de aprendizaje.

## 📄 Licencia

MIT
