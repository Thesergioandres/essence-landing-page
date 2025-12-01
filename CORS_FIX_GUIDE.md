# Solución de Errores CORS - Essence Landing Page

## 🔴 Error Actual
```
Access to XMLHttpRequest at 'https://essence-landing-page-production.up.railway.app/api/products' 
from origin 'https://ssence-landing-page-client.vercel.app' has been blocked by CORS policy
```

## ✅ Soluciones Implementadas

### 1. Configuración de CORS Mejorada (server.js)
- ✅ Lista explícita de orígenes permitidos
- ✅ Soporte para subdominios de Vercel (regex)
- ✅ Soporte para subdominios de Railway (regex)
- ✅ Manejo de preflight requests (OPTIONS)
- ✅ Cache de 24 horas para preflight
- ✅ Logs de debugging para origins bloqueados

### 2. Verificar Variables de Entorno

#### **Railway (Backend)**
Asegúrate de que estén configuradas estas variables en Railway:

```env
NODE_ENV=production
PORT=5000
MONGODB_URI=tu_mongodb_uri
JWT_SECRET=tu_jwt_secret
CLOUDINARY_CLOUD_NAME=tu_cloudinary_name
CLOUDINARY_API_KEY=tu_cloudinary_key
CLOUDINARY_API_SECRET=tu_cloudinary_secret
```

**No necesitas configurar FRONTEND_URL** ya que ahora el CORS acepta múltiples orígenes automáticamente.

#### **Vercel (Frontend)**
Asegúrate de que esté configurada esta variable en Vercel:

```env
VITE_API_URL=https://essence-landing-page-production.up.railway.app/api
```

### 3. Comandos para Verificar

#### En Railway:
1. Ve a tu proyecto en Railway
2. Click en "Variables"
3. Verifica que `MONGODB_URI` esté configurado
4. Verifica que no haya espacios al inicio o final de las URLs

#### En Vercel:
1. Ve a tu proyecto en Vercel
2. Settings → Environment Variables
3. Verifica que `VITE_API_URL` apunte a: `https://essence-landing-page-production.up.railway.app/api`
4. **Importante**: Después de cambiar variables de entorno, debes hacer **Redeploy**

### 4. Pasos de Debugging

Si el error persiste:

1. **Verifica que el backend esté funcionando**:
   ```bash
   curl https://essence-landing-page-production.up.railway.app/
   ```
   Deberías ver un JSON con `message: "🚀 Essence API funcionando correctamente"`

2. **Verifica los headers CORS**:
   ```bash
   curl -I -X OPTIONS https://essence-landing-page-production.up.railway.app/api/products \
     -H "Origin: https://ssence-landing-page-client.vercel.app" \
     -H "Access-Control-Request-Method: GET"
   ```
   Deberías ver `Access-Control-Allow-Origin` en la respuesta

3. **Revisa los logs de Railway**:
   - Ve a tu proyecto en Railway
   - Click en "Deployments" → "View Logs"
   - Busca mensajes de "❌ Origin bloqueado:" o errores de conexión

4. **Verifica la URL en el frontend**:
   - Abre las DevTools del navegador
   - Ve a la pestaña "Network"
   - Busca la petición fallida
   - Verifica que la URL sea exactamente: `https://essence-landing-page-production.up.railway.app/api/products`

### 5. Fix Rápido (Temporal)

Si necesitas una solución inmediata, puedes temporalmente permitir todos los orígenes:

En `server.js` línea 42:
```javascript
callback(null, true); // Ya está configurado así temporalmente
```

### 6. Después de los Cambios

1. **Hacer commit y push**:
   ```bash
   git add .
   git commit -m "fix: Mejorar configuración CORS para producción"
   git push
   ```

2. **Railway se desplegará automáticamente**

3. **En Vercel, hacer Redeploy**:
   - Ve a Vercel Dashboard
   - Click en tu proyecto
   - Click en "Deployments"
   - Click en los "..." del último deployment
   - Click en "Redeploy"

### 7. Orígenes Permitidos Actuales

```javascript
- http://localhost:3000
- http://localhost:5173
- https://ssence-landing-page-client.vercel.app
- https://essence-landing-page-production.up.railway.app
- *.vercel.app (todos los subdominios)
- *.railway.app (todos los subdominios)
```

## 🚨 Errores Comunes

1. **Error**: "No 'Access-Control-Allow-Origin' header"
   - **Solución**: Verificar que Railway esté funcionando y desplegado

2. **Error**: "ERR_NETWORK" o "Failed to load resource"
   - **Solución**: Verificar que la URL del backend sea correcta en `VITE_API_URL`

3. **Error**: Variables de entorno no se aplican
   - **Solución**: Hacer Redeploy en Vercel después de cambiar variables

4. **Error**: CORS funciona en local pero no en producción
   - **Solución**: Verificar que los dominios estén exactamente como en la lista de `allowedOrigins`

## 📞 Siguiente Paso

Después de hacer el push, espera 2-3 minutos para que Railway se redespliegue y luego prueba nuevamente la aplicación en Vercel.
