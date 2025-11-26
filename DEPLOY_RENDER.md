# Desplegar Backend en Render

## Pasos:

### 1. Crear cuenta en Render

- Ve a: https://render.com/
- Click "Get Started" → Conecta con GitHub

### 2. Crear Web Service

- En el dashboard, click "New +" → "Web Service"
- Conecta tu repositorio: `essence-landing-page`
- Click "Connect"

### 3. Configurar el servicio

Llena los campos:

- **Name**: `essence-backend`
- **Root Directory**: `server`
- **Runtime**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Plan**: Free (o Starter si necesitas más)

### 4. Agregar variables de entorno

En la sección **Environment Variables**, agrega:

```
MONGODB_URI=mongodb+srv://sergio:sergio123@cluster0.ztdix.mongodb.net/essence?retryWrites=true&w=majority&appName=Cluster0
JWT_SECRET=tu_clave_secreta_super_segura_cambiame
NODE_ENV=production
PORT=5000
FRONTEND_URL=https://essence-landing-page.vercel.app
```

### 5. Desplegar

- Click "Create Web Service"
- Espera 5-10 minutos mientras se despliega
- Copia la URL (ejemplo: `essence-backend.onrender.com`)

### 6. Actualizar frontend

- Ve a Vercel → proyecto frontend → Settings → Environment Variables
- Edita `VITE_API_URL` y pon: `https://essence-backend.onrender.com`
- Redeploy el frontend

## Ventajas de Render:

- ✅ Gratis (con límites)
- ✅ Configuración simple
- ✅ Funciona bien con MongoDB
- ✅ Auto-deploys desde GitHub
- ✅ SSL incluido

## Nota sobre plan Free:

- El servicio se "duerme" después de 15 minutos de inactividad
- Primera petición puede tardar 30-60 segundos en despertar
- Para evitar esto, usa plan Starter ($7/mes)
