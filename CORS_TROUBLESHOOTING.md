# 🔧 Guía de Solución de Problemas - Despliegue

## ❌ Errores Comunes

### 1. Error de CORS

```
Access to XMLHttpRequest at 'https://backend.vercel.app/api/...'
from origin 'https://frontend.vercel.app' has been blocked by CORS policy
```

### 2. Error 500 (Internal Server Error)

```
GET https://backend.vercel.app/api/products 500 (Internal Server Error)
Error: Request failed with status code 500
```

**Causa más común:** MongoDB no está conectado o `MONGODB_URI` no está configurada.

## 🎯 Causas de los Problemas

Los errores ocurren cuando:

1. ❌ **CORS**: El backend no tiene configurado CORS correctamente
2. ❌ **Variables de entorno**: No están sincronizadas entre frontend y backend
3. ❌ **MongoDB**: La variable `MONGODB_URI` no está configurada o es incorrecta
4. ❌ **MongoDB Atlas**: No permite conexiones desde Vercel (IP whitelist)

## ✅ Solución Paso a Paso

### 1. Identificar tus URLs de Vercel

Primero, identifica las URLs exactas de tus deployments:

- **Frontend**: `https://essence-landing-page.vercel.app`
- **Backend**: `https://essence-landing-page-fvp2.vercel.app`

### 2. Configurar Variables de Entorno en Frontend

Ve a tu proyecto de **frontend** en Vercel:

1. Abre: https://vercel.com/thesergioandres-projects/essence-landing-page
2. Ve a **Settings** → **Environment Variables**
3. Agrega o edita:
   ```
   VITE_API_URL=https://essence-landing-page-fvp2.vercel.app/api
   ```
4. **IMPORTANTE**: Selecciona las 3 opciones:
   - ✅ Production
   - ✅ Preview
   - ✅ Development
5. Clic en **Save**

### 3. Configurar Variables de Entorno en Backend

Ve a tu proyecto de **backend** en Vercel:

1. Abre: https://vercel.com/thesergioandres-projects/essence-backend
2. Ve a **Settings** → **Environment Variables**
3. **CRÍTICO**: Verifica o agrega TODAS estas variables:
   ```
   MONGODB_URI=mongodb+srv://usuario:password@cluster.mongodb.net/essence?retryWrites=true&w=majority
   FRONTEND_URL=https://essence-landing-page.vercel.app
   NODE_ENV=production
   JWT_SECRET=tu_secret_key_super_segura
   ```
4. **⚠️ IMPORTANTE**: La variable debe llamarse `MONGODB_URI` (no `MONGO_URI`)
5. Clic en **Save**

**📌 Nota sobre MONGODB_URI:**

- El código ahora soporta tanto `MONGODB_URI` como `MONGO_URI` por compatibilidad
- Pero en Vercel usa `MONGODB_URI` para seguir el estándar

### 4. Redesplegar Ambos Proyectos

Después de cambiar variables de entorno, **debes redesplegar**:

**Frontend:**

1. Ve a **Deployments**
2. Clic en el último deployment
3. Menú (⋮) → **Redeploy**
4. Confirma

**Backend:**

1. Ve a **Deployments**
2. Clic en el último deployment
3. Menú (⋮) → **Redeploy**
4. Confirma

### 5. Verificar la Configuración

Después del redespliegue:

**Probar Backend:**

```bash
curl https://essence-landing-page-fvp2.vercel.app/
```

Deberías ver:

```json
{ "message": "🚀 Essence API funcionando correctamente" }
```

**Probar Frontend:**

1. Abre: https://essence-landing-page.vercel.app
2. Presiona **F12** para abrir DevTools
3. Ve a la pestaña **Console**
4. **NO** debe haber errores de CORS
5. Los productos deberían cargar correctamente

## 🔍 Debugging Avanzado

### Verificar Variables de Entorno en el Frontend

Agrega temporalmente esto en `client/src/App.tsx`:

```tsx
console.log("API URL:", import.meta.env.VITE_API_URL);
```

Despliega y verifica en la consola del navegador.

### Verificar Headers CORS en el Backend

Usa DevTools → Network:

1. Filtra por "products" o cualquier endpoint
2. Clic en la petición
3. Ve a **Headers** → **Response Headers**
4. Busca: `access-control-allow-origin`
5. Debe mostrar tu frontend URL o `*`

### Verificar que CORS esté habilitado

El backend ya tiene CORS configurado en `server/server.js`:

```javascript
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? (origin, callback) => {
            // Permite todas las URLs de Vercel
            if (
              !origin ||
              origin.endsWith(".vercel.app") ||
              origin === FRONTEND_URL
            ) {
              callback(null, true);
            } else {
              callback(new Error("Not allowed by CORS"));
            }
          }
        : ["http://localhost:3000", "http://localhost:5173"],
    credentials: true,
  })
);
```

## 📋 Checklist de Verificación

### Variables de Entorno
- [ ] Variable `VITE_API_URL` configurada en frontend
- [ ] Variable `MONGODB_URI` configurada en backend (⚠️ NO `MONGO_URI`)
- [ ] Variable `FRONTEND_URL` configurada en backend
- [ ] Variable `JWT_SECRET` configurada en backend
- [ ] Variable `NODE_ENV=production` configurada en backend
- [ ] Variables aplicadas a Production, Preview y Development

### MongoDB Atlas
- [ ] Cluster creado en MongoDB Atlas
- [ ] Usuario de base de datos creado
- [ ] Network Access permite `0.0.0.0/0`
- [ ] Cadena de conexión correcta en `MONGODB_URI`

### Despliegues
- [ ] Frontend redesplegado después de cambiar variables
- [ ] Backend redesplegado después de cambiar variables
- [ ] Backend responde en `https://backend.vercel.app/`
- [ ] No hay errores 500 en la consola del navegador
- [ ] No hay errores de CORS en la consola del navegador
- [ ] Los productos cargan correctamente en el frontend

## 🚨 Problemas Comunes

### 1. Error 500 - Internal Server Error

**Síntoma:**
```
GET https://backend.vercel.app/api/products 500 (Internal Server Error)
```

**Causa:** MongoDB no puede conectarse

**Solución:**
1. Ve a Vercel → Backend → Deployments → Último deployment → View Function Logs
2. Busca errores como:
   - `Error conectando a MongoDB`
   - `MONGODB_URI no está definida`
   - `Authentication failed`
3. Verifica que `MONGODB_URI` esté correctamente configurada en Vercel
4. Verifica que la contraseña en la URI no tenga caracteres especiales sin encodear
5. Verifica que MongoDB Atlas permita conexiones desde `0.0.0.0/0`

### 2. Error persiste después de redesplegar

**Causa**: Caché del navegador
**Solución**:

- Abre el frontend en **modo incógnito**
- O presiona **Ctrl + Shift + R** (recarga forzada)

### 3. Backend no responde

**Causa**: MongoDB no conectado o variables faltantes
**Solución**:

1. Revisa logs en Vercel → Backend → Deployments → View Function Logs
2. Verifica que `MONGODB_URI` esté correctamente configurada (no `MONGO_URI`)
3. Verifica que MongoDB Atlas permita conexiones desde `0.0.0.0/0`
4. Prueba la conexión localmente actualizando tu `.env` local

### 4. CORS funciona en localhost pero no en producción

**Causa**: Variables de entorno no sincronizadas
**Solución**:

1. Crea un archivo `.env` local en `client/`:
   ```
   VITE_API_URL=https://essence-landing-page-fvp2.vercel.app/api
   ```
2. Prueba localmente antes de desplegar
3. Asegúrate que las mismas variables estén en Vercel

### 5. "Failed to fetch" o "Network Error"

**Causa**: Backend caído o URL incorrecta
**Solución**:

1. Abre directamente: `https://backend.vercel.app/`
2. Debe mostrar: `{"message":"🚀 Essence API funcionando correctamente"}`
3. Si no responde, revisa logs del backend en Vercel

### 6. Variable MONGODB_URI vs MONGO_URI

**Problema:** Inconsistencia histórica en el nombre de la variable

**Solución Implementada:**
El código del backend (`config/database.js`) ahora soporta ambos nombres:
```javascript
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
```

**Recomendación:** Usa `MONGODB_URI` en Vercel (es el estándar)

1. Crea un archivo `.env` local en `client/`:
   ```
   VITE_API_URL=https://essence-landing-page-fvp2.vercel.app/api
   ```
2. Prueba localmente antes de desplegar
3. Asegúrate que las mismas variables estén en Vercel

### "Failed to fetch" o "Network Error"

**Causa**: Backend caído o URL incorrecta
**Solución**:

1. Abre directamente: `https://backend.vercel.app/`
2. Debe mostrar: `{"message":"🚀 Essence API funcionando correctamente"}`
3. Si no responde, revisa logs del backend en Vercel

## 💡 Tips

1. **Siempre redesplegar después de cambiar variables de entorno**
2. **Usar modo incógnito para probar** (evita problemas de caché)
3. **Verificar logs en Vercel** para ver errores del servidor
4. **Usar DevTools → Network** para inspeccionar peticiones HTTP
5. **La configuración de CORS del backend permite TODOS los dominios `.vercel.app`**

## 🔗 URLs Útiles

- Frontend: https://vercel.com/thesergioandres-projects/essence-landing-page
- Backend: https://vercel.com/thesergioandres-projects/essence-backend
- MongoDB Atlas: https://cloud.mongodb.com/

---

**Última actualización:** 25 de noviembre de 2025
