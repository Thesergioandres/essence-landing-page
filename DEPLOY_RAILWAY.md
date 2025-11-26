# Desplegar Backend en Railway

## Pasos:

### 1. Crear cuenta en Railway

- Ve a: https://railway.app/
- Click "Login" → Conecta con GitHub

### 2. Crear nuevo proyecto

- Click "New Project"
- Selecciona "Deploy from GitHub repo"
- Busca y selecciona: `essence-landing-page`
- Railway detectará automáticamente que es Node.js

### 3. Configurar el servicio

- Click en el servicio que se creó
- Ve a **Settings**
- En **Root Directory**, pon: `server`
- En **Start Command**, pon: `npm start`

### 4. Agregar variables de entorno

- Ve a la pestaña **Variables**
- Click "+ New Variable" y agrega:

```
MONGODB_URI=mongodb+srv://sergio:sergio123@cluster0.ztdix.mongodb.net/essence?retryWrites=true&w=majority&appName=Cluster0
JWT_SECRET=tu_clave_secreta_super_segura_cambiame
NODE_ENV=production
PORT=5000
FRONTEND_URL=https://essence-landing-page.vercel.app
```

### 5. Generar dominio

- Ve a **Settings** → **Networking**
- Click "Generate Domain"
- Copia la URL que te da (ejemplo: `essence-backend-production.up.railway.app`)

### 6. Actualizar frontend

- Ve a Vercel → proyecto frontend → Settings → Environment Variables
- Edita `VITE_API_URL` y pon la URL de Railway
- Redeploy el frontend

## Ventajas de Railway:

- ✅ Detecta automáticamente Node.js
- ✅ No necesita configuración serverless
- ✅ Funciona mejor con conexiones persistentes a MongoDB
- ✅ Logs más claros
- ✅ $5 gratis al mes (suficiente para desarrollo)
