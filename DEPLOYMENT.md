# 🚀 Guía de Despliegue en Vercel

## Preparación del Proyecto

### 1. Variables de Entorno

#### Backend (Server)
Crea las siguientes variables en Vercel para el backend:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/essence?retryWrites=true&w=majority
JWT_SECRET=tu_clave_secreta_jwt_muy_segura_aqui
NODE_ENV=production
FRONTEND_URL=https://tu-frontend.vercel.app
CLOUDINARY_CLOUD_NAME=tu_cloud_name (opcional)
CLOUDINARY_API_KEY=tu_api_key (opcional)
CLOUDINARY_API_SECRET=tu_api_secret (opcional)
```

#### Frontend (Client)
Crea un archivo `.env` en la carpeta `client`:

```env
VITE_API_URL=https://tu-backend.vercel.app/api
```

### 2. Despliegue del Backend

1. Ve a [Vercel](https://vercel.com)
2. Crea un nuevo proyecto
3. Importa el repositorio de GitHub
4. Configura:
   - **Framework Preset**: Other
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Output Directory**: `.`
   - **Install Command**: `npm install`

5. Agrega las variables de entorno mencionadas arriba
6. Deploy

7. Copia la URL del backend (ejemplo: `https://essence-backend.vercel.app`)

### 3. Despliegue del Frontend

1. En Vercel, crea otro proyecto nuevo
2. Importa el mismo repositorio de GitHub
3. Configura:
   - **Framework Preset**: Vite
   - **Root Directory**: `client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

4. Agrega la variable de entorno:
   ```
   VITE_API_URL=https://tu-backend.vercel.app/api
   ```

5. Deploy

### 4. MongoDB Atlas (Gratis)

1. Ve a [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Crea una cuenta gratuita
3. Crea un cluster (M0 - Free tier)
4. En "Database Access", crea un usuario con contraseña
5. En "Network Access", agrega `0.0.0.0/0` (permite acceso desde cualquier IP)
6. En "Connect", obtén la cadena de conexión:
   ```
   mongodb+srv://<username>:<password>@cluster.mongodb.net/essence
   ```
7. Copia esta URL y úsala como `MONGODB_URI` en Vercel

### 5. Configuración CORS

El backend ya está configurado para aceptar el origen del frontend.
Asegúrate de actualizar `FRONTEND_URL` en las variables de entorno del backend
con la URL real de tu frontend en Vercel.

## 📋 Checklist de Despliegue

### Backend
- [ ] Proyecto creado en Vercel
- [ ] Root directory configurado a `server`
- [ ] Variables de entorno agregadas:
  - [ ] MONGODB_URI
  - [ ] JWT_SECRET
  - [ ] NODE_ENV=production
  - [ ] FRONTEND_URL
- [ ] Deploy exitoso
- [ ] Probar endpoint: `https://tu-backend.vercel.app/`

### Frontend
- [ ] Proyecto creado en Vercel
- [ ] Root directory configurado a `client`
- [ ] Variable VITE_API_URL agregada
- [ ] Build exitoso
- [ ] Deploy exitoso
- [ ] Aplicación funcional en navegador

### Database
- [ ] Cluster de MongoDB Atlas creado
- [ ] Usuario de base de datos creado
- [ ] Network access configurado (0.0.0.0/0)
- [ ] Cadena de conexión obtenida
- [ ] Conexión probada

## 🔧 Solución de Problemas

### Error de CORS
Si ves errores de CORS en la consola:
1. Verifica que `FRONTEND_URL` en el backend coincida con tu URL de frontend
2. Asegúrate que el backend incluya la URL del frontend en CORS

### Error de Conexión a MongoDB
1. Verifica que la IP `0.0.0.0/0` esté en Network Access
2. Revisa que usuario y contraseña sean correctos
3. Asegúrate que la cadena de conexión tenga el formato correcto

### Build Fallido
1. Revisa los logs de Vercel
2. Asegúrate que todas las dependencias estén en `package.json`
3. Verifica que los comandos de build sean correctos

## 🌐 URLs de Ejemplo

Después del deploy, tendrás:
- Frontend: `https://essence-app.vercel.app`
- Backend: `https://essence-backend.vercel.app`
- API: `https://essence-backend.vercel.app/api`

## 📱 Optimizaciones Móviles

Todas las optimizaciones móviles implementadas funcionarán automáticamente:
- ✅ Responsive design (320px - 1920px+)
- ✅ Touch targets de 44-52px
- ✅ Skeleton loaders
- ✅ Lazy loading de imágenes
- ✅ HMR y optimizaciones de Vite

## 🔄 Actualizaciones Continuas

Vercel detecta automáticamente cambios en GitHub:
1. Haz push a la rama `dev` o `main`
2. Vercel ejecuta el build automáticamente
3. Deploy en segundos

## 💡 Tips

- Usa la rama `main` para producción
- Usa la rama `dev` para desarrollo
- Vercel puede crear previews para cada PR
- El plan gratuito incluye:
  - 100 GB de bandwidth
  - Despliegues ilimitados
  - SSL automático
  - CDN global
