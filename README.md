# 🚀 Essence - Sistema de Gestión de Productos y Ventas

Sistema completo de gestión para distribuidores de productos tecnológicos con panel de administración, gamificación, análisis de ventas y gestión de inventario.

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![React](https://img.shields.io/badge/React-19.1.0-61dafb.svg)
![Node](https://img.shields.io/badge/Node-18+-green.svg)

## ✨ Características Principales

### 📱 Frontend (React + Vite + Tailwind CSS 4)
- ✅ **Diseño Responsivo**: Optimizado para móviles (320px+) hasta desktop
- ✅ **Autenticación JWT**: Login separado para Admin y Distribuidores
- ✅ **Panel de Administración**: Gestión completa de productos, categorías y distribuidores
- ✅ **Panel de Distribuidor**: Registro de ventas, inventario personal, reportes
- ✅ **Catálogo Público**: Navegación de productos con filtros y búsqueda
- ✅ **Sistema de Gamificación**: Rankings, logros, recompensas
- ✅ **Análisis y Reportes**: Gráficos interactivos con Recharts
- ✅ **Exportación PDF**: Reportes descargables con jsPDF
- ✅ **Gestión de Defectuosos**: Control de productos dañados
- ✅ **Sistema de Auditoría**: Registro de todas las acciones

### 🔧 Backend (Node.js + Express + MongoDB)
- ✅ **API RESTful**: Arquitectura organizada con rutas modulares
- ✅ **Base de Datos**: MongoDB con Mongoose
- ✅ **Autenticación**: JWT con middleware de protección
- ✅ **Upload de Imágenes**: Cloudinary integration
- ✅ **Control de Stock**: Inventario de bodega y distribuidores
- ✅ **Sistema de Alertas**: Notificaciones de stock bajo
- ✅ **Analytics**: Estadísticas de ventas y ganancias
- ✅ **Gamificación**: Sistema de puntos y logros
- ✅ **Auditoría**: Log de todas las operaciones

### 📊 Optimizaciones Móviles
- ✅ Touch targets mínimos de 44px (WCAG 2.1)
- ✅ Skeleton loaders para mejor UX
- ✅ Lazy loading de imágenes
- ✅ Active states con feedback táctil
- ✅ Tablas responsivas (cards en móvil)
- ✅ Menú hamburguesa funcional
- ✅ Sidebars deslizantes con overlay
- ✅ Tipografía fluida progresiva

## 🛠️ Stack Tecnológico

### Frontend
- React 19.1 - TypeScript - Vite 6.3 - Tailwind CSS 4.1
- React Router 7.9 - Axios - Recharts - jsPDF

### Backend
- Node.js - Express - MongoDB - Mongoose
- JWT - Cloudinary - bcrypt - CORS

## 📦 Instalación Local

### Prerrequisitos
- Node.js 18+ instalado
- MongoDB instalado y corriendo
- Git

### 1. Clonar el repositorio
```bash
git clone https://github.com/thesergioandres/essence-landing-page.git
cd essence-landing-page
```

### 2. Configurar Backend
```bash
cd server
npm install
cp .env.example .env
# Edita .env con tus configuraciones
npm start
```

### 3. Configurar Frontend
```bash
cd ../client
npm install
cp .env.example .env
# Edita .env con la URL del backend
npm run dev
```

### 4. Acceder a la aplicación
- Frontend: http://localhost:3000
- Backend: http://localhost:5000

## 🌐 Despliegue en Vercel

**Guía completa:** [DEPLOYMENT.md](./DEPLOYMENT.md)

### Resumen:
1. **Backend**: Deploy con root `server` + variables de entorno
2. **Frontend**: Deploy con root `client` + VITE_API_URL
3. **MongoDB Atlas**: Cluster gratuito M0

## 📁 Estructura

```
essence-landing-page/
├── client/                  # Frontend React
│   ├── src/
│   │   ├── api/            # Services
│   │   ├── components/     # Componentes
│   │   ├── pages/          # Páginas
│   │   └── ...
│   └── package.json
├── server/                  # Backend Node.js
│   ├── controllers/        # Lógica
│   ├── models/             # Mongoose
│   ├── routes/             # API routes
│   └── server.js
└── README.md
```

## 🔑 Variables de Entorno

### Backend (.env)
```env
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/essence
JWT_SECRET=your_secret_key
FRONTEND_URL=https://your-frontend.vercel.app
```

### Frontend (.env)
```env
VITE_API_URL=https://your-backend.vercel.app/api
```

## 👨‍💻 Autor

**Sergio Andrés**
- GitHub: [@thesergioandres](https://github.com/thesergioandres)

---

⭐ Si te fue útil, dale una estrella en GitHub!
