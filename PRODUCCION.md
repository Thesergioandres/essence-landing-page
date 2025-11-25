# 🚀 Guía Completa de Despliegue en Vercel - Essence

## 📋 Variables de Entorno Requeridas

### Backend (Server)
| Variable | Descripción | Ejemplo | Requerido |
|----------|-------------|---------|-----------|
| `MONGODB_URI` | Cadena de conexión a MongoDB Atlas | `mongodb+srv://user:pass@cluster.mongodb.net/essence?retryWrites=true&w=majority` | ✅ Sí |
| `JWT_SECRET` | Clave secreta para tokens JWT | `mi_clave_super_secreta_123` | ✅ Sí |
| `NODE_ENV` | Entorno de ejecución | `production` | ✅ Sí |
| `FRONTEND_URL` | URL del frontend para CORS | `https://tu-frontend.vercel.app` | ✅ Sí |
| `PORT` | Puerto del servidor | `5000` | ❌ No (Vercel lo asigna automáticamente) |
| `CLOUDINARY_CLOUD_NAME` | Nombre del cloud de Cloudinary | `tu_cloud_name` | ❌ Opcional |
| `CLOUDINARY_API_KEY` | API Key de Cloudinary | `123456789012345` | ❌ Opcional |
| `CLOUDINARY_API_SECRET` | API Secret de Cloudinary | `abcdefghijklmnopqrstuvwxyz` | ❌ Opcional |

### Frontend (Client)
| Variable | Descripción | Ejemplo | Requerido |
|----------|-------------|---------|-----------|
| `VITE_API_URL` | URL del backend API | `https://tu-backend.vercel.app/api` | ✅ Sí |

## 🌐 Despliegue Paso a Paso desde la Web de Vercel

### PASO 1: Preparar MongoDB Atlas (Base de Datos)

#### 1.1 Crear Cuenta
1. Ve a https://www.mongodb.com/cloud/atlas/register
2. Regístrate con Google/GitHub o email (gratis, sin tarjeta)
3. Completa el formulario de registro

#### 1.2 Crear Cluster Gratuito
1. En el dashboard, clic en **"Create"** o **"Build a Database"**
2. Elige el plan **M0 (FREE)** - 512 MB gratuito
3. Configuración:
   - **Cloud Provider**: AWS (recomendado)
   - **Region**: Elige la más cercana (ej: `us-east-1`, `us-west-2`)
   - **Cluster Tier**: M0 Sandbox (Free Forever)
   - **Cluster Name**: `essence-cluster` (o cualquier nombre)
4. Clic en **"Create Cluster"** (tarda 3-5 minutos)

#### 1.3 Configurar Acceso a la Base de Datos
**A) Crear Usuario de Base de Datos**
1. En el menú lateral, clic en **"Database Access"**
2. Clic en **"Add New Database User"**
3. Configurar:
   - **Authentication Method**: Password
   - **Username**: `essence_admin` (puedes usar otro nombre)
   - **Password**: Genera una contraseña segura o crea una personalizada
   - **⚠️ IMPORTANTE**: Copia y guarda esta contraseña (la necesitarás)
   - **Database User Privileges**: Atlas admin o Read and write to any database
4. Clic en **"Add User"**

**B) Permitir Acceso desde Internet**
1. En el menú lateral, clic en **"Network Access"**
2. Clic en **"Add IP Address"**
3. Clic en **"Allow Access from Anywhere"**
   - Esto agregará `0.0.0.0/0` (necesario para Vercel)
4. Clic en **"Confirm"**

#### 1.4 Obtener Cadena de Conexión
1. Vuelve a **"Database"** en el menú lateral
2. Clic en **"Connect"** en tu cluster
3. Selecciona **"Connect your application"**
4. Configuración:
   - **Driver**: Node.js
   - **Version**: 4.1 or later
5. Copia la cadena de conexión (se verá así):
   ```
   mongodb+srv://essence_admin:<password>@essence-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. **IMPORTANTE**: Reemplaza `<password>` con tu contraseña real y agrega `/essence` después del `.net`:
   ```
   mongodb+srv://essence_admin:TU_PASSWORD_AQUI@essence-cluster.xxxxx.mongodb.net/essence?retryWrites=true&w=majority
   ```
7. **⚠️ Guarda esta cadena completa** - la usarás en Vercel

---

### PASO 2: Desplegar Backend en Vercel

#### 2.1 Conectar GitHub a Vercel
1. Ve a https://vercel.com y inicia sesión (crea cuenta si no tienes)
2. Clic en **"Add New..."** → **"Project"**
3. Clic en **"Import Git Repository"**
4. Si es la primera vez, autoriza Vercel para acceder a GitHub
5. Busca y selecciona tu repositorio: `essence-landing-page`
6. Clic en **"Import"**

#### 2.2 Configurar Backend
1. En la pantalla de configuración del proyecto:
   - **Project Name**: `essence-backend` (o cualquier nombre)
   - **Framework Preset**: Other
   - **Root Directory**: Clic en **"Edit"** → Selecciona **`server`**
   - **Build Command**: Dejar vacío o `npm install`
   - **Output Directory**: Dejar vacío
   - **Install Command**: `npm install`

2. **Configurar Variables de Entorno** (clic en "Environment Variables"):
   
   Agrega cada una de estas variables:
   
   | Name | Value | Environment |
   |------|-------|-------------|
   | `MONGODB_URI` | `mongodb+srv://essence_admin:TU_PASSWORD@essence-cluster.xxxxx.mongodb.net/essence?retryWrites=true&w=majority` | Production |
   | `JWT_SECRET` | `mi_clave_secreta_super_segura_cambiar_en_produccion_2024` | Production |
   | `NODE_ENV` | `production` | Production |
   | `FRONTEND_URL` | `DEJAR_VACIO_POR_AHORA` | Production |

   **Nota**: La variable `FRONTEND_URL` la actualizaremos después de desplegar el frontend.

3. Clic en **"Deploy"** (tarda 1-2 minutos)

4. Una vez completado, copia la URL del backend (ejemplo):
   ```
   https://essence-backend.vercel.app
   ```
   O puede ser algo como:
   ```
   https://essence-backend-xxxxx.vercel.app
   ```

5. **⚠️ IMPORTANTE**: Ve a la configuración del proyecto:
   - Clic en **"Settings"** (arriba)
   - Clic en **"Domains"** (menú lateral)
   - Copia el dominio principal/permanente (será algo como `essence-backend.vercel.app`)

---

### PASO 3: Desplegar Frontend en Vercel

#### 3.1 Importar Segundo Proyecto
1. En el dashboard de Vercel, clic en **"Add New..."** → **"Project"**
2. Selecciona nuevamente tu repositorio `essence-landing-page`
3. Clic en **"Import"**

#### 3.2 Configurar Frontend
1. En la pantalla de configuración:
   - **Project Name**: `essence-frontend` (o cualquier nombre)
   - **Framework Preset**: Vite
   - **Root Directory**: Clic en **"Edit"** → Selecciona **`client`**
   - **Build Command**: `npm run build` (debe detectarse automáticamente)
   - **Output Directory**: `dist` (debe detectarse automáticamente)
   - **Install Command**: `npm install`

2. **Configurar Variables de Entorno**:
   
   | Name | Value | Environment |
   |------|-------|-------------|
   | `VITE_API_URL` | `https://essence-backend.vercel.app/api` | Production |
   
   **⚠️ IMPORTANTE**: Usa la URL del backend del PASO 2 (paso 4) y agrega `/api` al final.

3. Clic en **"Deploy"** (tarda 1-2 minutos)

4. Una vez completado, copia la URL del frontend (ejemplo):
   ```
   https://essence-frontend.vercel.app
   ```

---

### PASO 4: Actualizar FRONTEND_URL en el Backend

#### 4.1 Actualizar Variable de Entorno
1. Ve al proyecto del backend en Vercel
2. Clic en **"Settings"** → **"Environment Variables"**
3. Busca `FRONTEND_URL`
4. Clic en los 3 puntos **"⋮"** → **"Edit"**
5. Cambia el valor a la URL del frontend (del PASO 3, paso 4):
   ```
   https://essence-frontend.vercel.app
   ```
6. Clic en **"Save"**

#### 4.2 Redesplegar Backend
1. Ve a la pestaña **"Deployments"** del proyecto backend
2. Busca el último despliegue (el primero de la lista)
3. Clic en los 3 puntos **"⋮"** → **"Redeploy"**
4. Confirma el redespliegue

---

### PASO 5: Crear Usuario Administrador

#### 5.1 Configurar Entorno Local con Atlas
1. Abre el archivo `.env` en la carpeta `server`:
   ```bash
   cd "c:\Users\sergu\OneDrive\Desktop\landing essence\react-tailwindcss\server"
   notepad .env
   ```

2. Actualiza la variable `MONGODB_URI` con tu cadena de MongoDB Atlas:
   ```env
   MONGODB_URI=mongodb+srv://essence_admin:TU_PASSWORD@essence-cluster.xxxxx.mongodb.net/essence?retryWrites=true&w=majority
   JWT_SECRET=mi_clave_secreta_super_segura
   ```

3. Guarda el archivo

#### 5.2 Ejecutar Script de Seed
```powershell
cd "c:\Users\sergu\OneDrive\Desktop\landing essence\react-tailwindcss\server"
node seedAdmin.js
```

Deberías ver:
```
✅ Conectado a MongoDB
✅ Usuario administrador creado exitosamente:
{
  id: '...',
  name: 'Administrador',
  email: 'serguito2003@gmail.com',
  role: 'admin'
}
✅ Conexión cerrada
```

---

## ✅ Verificar que Todo Funciona

### 1. Probar el Frontend
1. Abre en modo incógnito: `https://essence-frontend.vercel.app`
2. Presiona **Ctrl + Shift + R** (recarga forzada sin caché)

### 2. Iniciar Sesión
- **Email**: `serguito2003@gmail.com`
- **Password**: `Serra_1707`

### 3. Verificar Funcionalidades
- ✅ Login funciona
- ✅ Dashboard carga correctamente
- ✅ Puedes ver productos y categorías
- ✅ No hay errores de CORS en la consola

---

## ✅ Despliegues Actuales

### Frontend
- **URL Permanente**: https://back-essence.vercel.app
- **Último Deploy**: https://back-essence-29qa6igzm-thesergioandres-projects.vercel.app
- **Proyecto Vercel**: `back-essence`
- **Estado**: ✅ Desplegado y funcionando

### Backend
- **URL Permanente**: https://server-thesergioandres-projects.vercel.app
- **Último Deploy**: https://server-d9np8usbv-thesergioandres-projects.vercel.app
- **Proyecto Vercel**: `server`
- **Estado**: ⚠️ Necesita configurar MongoDB Atlas

## 🔧 Variables de Entorno Configuradas Actualmente

### Backend (server)
```
✅ FRONTEND_URL=https://back-essence.vercel.app
✅ NODE_ENV=production
✅ JWT_SECRET=[configurado]
⚠️ MONGODB_URI=mongodb://localhost:27017/essence (INCORRECTO - usar Atlas)
```

### Frontend (back-essence)
```
✅ VITE_API_URL=https://server-thesergioandres-projects.vercel.app/api
```

---

## 🔄 Actualizar Despliegues Existentes

Si ya tienes proyectos desplegados y solo necesitas actualizar variables de entorno:

### Actualizar MONGODB_URI (Backend)
1. Ve a: https://vercel.com/thesergioandres-projects/server/settings/environment-variables
2. Busca `MONGODB_URI`
3. Clic en **"⋮"** → **"Edit"**
4. Pega tu cadena de MongoDB Atlas:
   ```
   mongodb+srv://essence_admin:TU_PASSWORD@essence-cluster.xxxxx.mongodb.net/essence?retryWrites=true&w=majority
   ```
5. Clic en **"Save"**
6. Ve a **"Deployments"** → Clic en el último → **"⋮"** → **"Redeploy"**

### Actualizar VITE_API_URL (Frontend)
1. Ve a: https://vercel.com/thesergioandres-projects/back-essence/settings/environment-variables
2. Busca `VITE_API_URL`
3. Clic en **"⋮"** → **"Edit"**
4. Asegúrate que sea:
   ```
   https://server-thesergioandres-projects.vercel.app/api
   ```
5. Clic en **"Save"**
6. Redesplegar si es necesario

---

## 🧪 Testing y Verificación

### 1. Probar Backend Directamente
Abre en el navegador:
```
https://server-thesergioandres-projects.vercel.app/
```
Deberías ver:
```json
{"message":"🚀 Essence API funcionando correctamente"}
```

### 2. Probar Frontend
1. Abre: https://back-essence.vercel.app
2. Presiona **Ctrl + Shift + R** (recarga sin caché)
3. Abre la consola del navegador (F12)
4. Verifica que no haya errores de CORS

### 3. Iniciar Sesión
- **Email**: `serguito2003@gmail.com`
- **Password**: `Serra_1707`

### 4. Verificar Funcionalidades
- ✅ Dashboard de administrador carga
- ✅ Puedes ver productos y categorías
- ✅ Puedes crear/editar productos
- ✅ Sistema de analytics funciona
- ✅ Gamificación muestra rankings

---

## ❌ Problema Actual Identificado

**Estado**: El backend está configurado con `mongodb://localhost:27017/essence`

**Por qué no funciona**:
- Vercel es serverless (sin servidor persistente)
- No puede conectarse a tu `localhost`
- Necesita MongoDB Atlas (base de datos en la nube)

**Síntomas**:
- Error de CORS en la consola
- "Failed to fetch" o "Network Error"
- Backend no responde correctamente

**Solución**: Seguir el PASO 1 de esta guía para configurar MongoDB Atlas

---

## 📋 Checklist de Despliegue

### Preparación Inicial
- [ ] Repositorio en GitHub configurado
- [ ] Cuenta de Vercel creada
- [ ] Cuenta de MongoDB Atlas creada

### MongoDB Atlas
- [ ] Cluster M0 (gratuito) creado
- [ ] Usuario de base de datos creado y contraseña guardada
- [ ] Network Access configurado (0.0.0.0/0)
- [ ] Cadena de conexión obtenida y guardada

### Backend en Vercel
- [ ] Proyecto importado desde GitHub
- [ ] Root directory configurado a `server`
- [ ] Variable `MONGODB_URI` agregada
- [ ] Variable `JWT_SECRET` agregada
- [ ] Variable `NODE_ENV=production` agregada
- [ ] Variable `FRONTEND_URL` agregada (después de frontend)
- [ ] Despliegue exitoso
- [ ] URL permanente copiada

### Frontend en Vercel
- [ ] Proyecto importado desde GitHub
- [ ] Root directory configurado a `client`
- [ ] Variable `VITE_API_URL` agregada con URL del backend + `/api`
- [ ] Despliegue exitoso
- [ ] URL permanente copiada

### Configuración Final
- [ ] Variable `FRONTEND_URL` actualizada en el backend
- [ ] Backend redesplegado con nueva variable
- [ ] Usuario administrador creado con `seedAdmin.js`
- [ ] Login funciona en producción
- [ ] No hay errores de CORS

---

## 🆘 Solución de Problemas Comunes

### Error: "No 'Access-Control-Allow-Origin' header"
**Causa**: CORS no configurado o `FRONTEND_URL` incorrecta

**Solución**:
1. Verifica que `FRONTEND_URL` en el backend sea exactamente la URL del frontend
2. Asegúrate que el backend esté redesplegado después de cambiar la variable
3. El archivo `server.js` ya tiene CORS configurado para aceptar `.vercel.app`

### Error: "Failed to fetch" o "Network Error"
**Causa**: Backend no puede conectarse a MongoDB

**Solución**:
1. Verifica que `MONGODB_URI` tenga la cadena completa de MongoDB Atlas
2. Verifica que el usuario de MongoDB tenga permisos
3. Verifica que Network Access permita `0.0.0.0/0`
4. Redesplega el backend después de actualizar variables

### Error: "Invalid credentials" al iniciar sesión
**Causa**: Usuario admin no existe en la base de datos de producción

**Solución**:
1. Actualiza `.env` local con la cadena de MongoDB Atlas
2. Ejecuta `node seedAdmin.js` desde la carpeta `server`
3. Verifica que el script se ejecute sin errores

### Error: "Build failed" en Vercel
**Causa**: Errores en el código o dependencias faltantes

**Solución**:
1. Revisa los logs del build en Vercel
2. Verifica que `package.json` tenga todas las dependencias
3. Asegúrate que el código compile localmente: `npm run build`

### Frontend no carga o muestra página en blanco
**Causa**: `VITE_API_URL` incorrecta o caché del navegador

**Solución**:
1. Verifica que `VITE_API_URL` termine en `/api`
2. Abre en modo incógnito
3. Presiona Ctrl + Shift + R (recarga forzada)
4. Verifica la consola del navegador (F12) para errores

### MongoDB Atlas: "Authentication failed"
**Causa**: Contraseña incorrecta o usuario sin permisos

**Solución**:
1. Verifica que la contraseña en `MONGODB_URI` sea correcta
2. Ve a "Database Access" en Atlas y verifica el usuario
3. El usuario debe tener rol "Atlas admin" o "Read and write to any database"
4. Recrea el usuario si es necesario

---

## 📞 Enlaces Útiles

### Producción
- **Frontend**: https://back-essence.vercel.app
- **Backend API**: https://server-thesergioandres-projects.vercel.app/api
- **Test Backend**: https://server-thesergioandres-projects.vercel.app/

### Paneles de Administración
- **Vercel Frontend**: https://vercel.com/thesergioandres-projects/back-essence
- **Vercel Backend**: https://vercel.com/thesergioandres-projects/server
- **MongoDB Atlas**: https://cloud.mongodb.com/
- **GitHub Repo**: https://github.com/thesergioandres/essence-landing-page

### Documentación
- **Vercel Docs**: https://vercel.com/docs
- **MongoDB Atlas Docs**: https://www.mongodb.com/docs/atlas/
- **Vite Docs**: https://vitejs.dev/
- **React Router**: https://reactrouter.com/

---

## 🎯 Credenciales de Acceso

### Administrador (después de ejecutar seedAdmin.js)
- **Email**: `serguito2003@gmail.com`
- **Password**: `Serra_1707`
- **Rol**: Admin (acceso completo al sistema)

### Para crear más usuarios
Ejecuta los scripts de seed en la carpeta `server/`:
```powershell
node seedAdmin.js        # Crear admin
node seedDistributor.js  # Crear distribuidor de ejemplo
node addTechProducts.js  # Agregar productos tecnológicos
```

---

## 🚀 Próximos Pasos Recomendados

1. **Configura MongoDB Atlas** siguiendo el PASO 1
2. **Actualiza las variables de entorno** con las cadenas correctas
3. **Ejecuta los scripts de seed** para poblar la base de datos
4. **Prueba la aplicación** en modo incógnito
5. **Configura un dominio personalizado** (opcional)
6. **Habilita Cloudinary** para subida de imágenes (opcional)

---

## 💡 Tips de Producción

### Seguridad
- ✅ Usa contraseñas fuertes para MongoDB
- ✅ Cambia `JWT_SECRET` a un valor único y seguro
- ✅ No compartas las variables de entorno públicamente
- ✅ Mantén actualizado el código y dependencias

### Performance
- ✅ Vercel incluye CDN global automático
- ✅ El frontend es estático (muy rápido)
- ✅ El backend es serverless (escala automáticamente)
- ✅ MongoDB Atlas tiene caché automático

### Monitoreo
- ✅ Revisa logs en Vercel para errores
- ✅ Monitorea uso de MongoDB Atlas (límite de 512 MB)
- ✅ Configura alertas en Vercel para errores
- ✅ Usa Vercel Analytics (opcional, de pago)

### Costos
- ✅ Vercel: Gratis hasta 100 GB de bandwidth/mes
- ✅ MongoDB Atlas: Gratis hasta 512 MB de almacenamiento
- ✅ Cloudinary: Gratis hasta 25 GB/mes (opcional)
- ✅ **Total: $0/mes para uso moderado**
