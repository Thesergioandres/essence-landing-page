# ⚠️ Solución Rápida - Error 500 (Internal Server Error)

## 🔴 Problema Actual

```
GET https://essence-landing-page-fvp2.vercel.app/api/products 500 (Internal Server Error)
Error: Request failed with status code 500
```

## ✅ Solución en 3 Pasos

### Paso 1: Verificar que MongoDB Atlas esté configurado

1. Ve a https://cloud.mongodb.com/
2. Inicia sesión
3. Verifica que tengas un cluster creado
4. Ve a **Database Access** → Debe haber un usuario
5. Ve a **Network Access** → Debe permitir `0.0.0.0/0`
6. Ve a **Database** → Clic en **Connect** → **Connect your application**
7. Copia la cadena de conexión (se ve así):
   ```
   mongodb+srv://usuario:password@cluster.mongodb.net/essence?retryWrites=true&w=majority
   ```
8. **IMPORTANTE**: Reemplaza `<password>` con tu contraseña real

### Paso 2: Configurar MONGODB_URI en Vercel

1. Ve a https://vercel.com
2. Abre tu proyecto de **backend**: `essence-landing-page-fvp2` o similar
3. Ve a **Settings** → **Environment Variables**
4. Busca si existe `MONGODB_URI` o `MONGO_URI`
5. Si existe, **edítala** (clic en ⋮ → Edit)
6. Si no existe, **créala** (clic en "Add New")
7. Configura:
   - **Name**: `MONGODB_URI` (exactamente así, en mayúsculas)
   - **Value**: Pega la cadena de conexión del Paso 1
   - **Environment**: Marca las 3 opciones (Production, Preview, Development)
8. Clic en **Save**

**Ejemplo de valor correcto:**

```
MONGODB_URI=mongodb+srv://essence_admin:MiPassword123@cluster0.xxxxx.mongodb.net/essence?retryWrites=true&w=majority
```

### Paso 3: Redesplegar el Backend

1. En el mismo proyecto de Vercel (backend)
2. Ve a **Deployments**
3. Clic en el **primer deployment** de la lista (el más reciente)
4. Clic en el menú ⋮ (tres puntos)
5. Clic en **Redeploy**
6. Selecciona **"Use existing Build Cache"**
7. Clic en **Redeploy** para confirmar
8. Espera 1-2 minutos

### Paso 4: Verificar que Funcione

1. Abre en una nueva pestaña:
   ```
   https://essence-landing-page-fvp2.vercel.app/
   ```
2. Deberías ver:
   ```json
   { "message": "🚀 Essence API funcionando correctamente" }
   ```
3. Si ves este mensaje, ¡MongoDB está conectado!

4. Ahora prueba el frontend:
   ```
   https://essence-landing-page.vercel.app/
   ```
5. Los productos deberían cargar sin errores

## 🔍 Verificar Logs en Vercel

Si el error persiste:

1. Ve a Vercel → Tu proyecto backend
2. Clic en **Deployments**
3. Clic en el último deployment
4. Clic en **View Function Logs** (o scroll hacia abajo)
5. Busca errores en rojo que mencionen:
   - `Error conectando a MongoDB`
   - `MONGODB_URI no está definida`
   - `Authentication failed`
   - `MongooseError`

### Errores Comunes en Logs

**"MONGODB_URI no está definida"**

- Solución: Vuelve al Paso 2 y configura la variable

**"Authentication failed"**

- Solución: La contraseña es incorrecta
- Ve a MongoDB Atlas → Database Access
- Resetea la contraseña del usuario
- Actualiza `MONGODB_URI` en Vercel con la nueva contraseña

**"IP is not whitelisted"**

- Solución: Ve a MongoDB Atlas → Network Access
- Agrega `0.0.0.0/0` a la lista blanca

## 📋 Checklist Final

- [ ] MongoDB Atlas cluster creado y activo
- [ ] Usuario de base de datos creado en Atlas
- [ ] Network Access permite `0.0.0.0/0`
- [ ] Cadena de conexión copiada correctamente (con contraseña)
- [ ] Variable `MONGODB_URI` configurada en Vercel (backend)
- [ ] Backend redesplegado después de agregar la variable
- [ ] `https://backend.vercel.app/` responde con mensaje de éxito
- [ ] Frontend carga productos sin errores 500

## 🎯 Variables de Entorno Necesarias en Backend

Tu backend en Vercel debe tener TODAS estas variables:

```env
MONGODB_URI=mongodb+srv://usuario:password@cluster.mongodb.net/essence?retryWrites=true&w=majority
JWT_SECRET=tu_clave_secreta_super_segura
NODE_ENV=production
FRONTEND_URL=https://essence-landing-page.vercel.app
```

## 💡 Tip Importante

Después de cambiar **cualquier variable de entorno** en Vercel, **SIEMPRE debes redesplegar** el proyecto para que los cambios se apliquen.

## 📞 URLs Útiles

- **Backend en Vercel**: https://vercel.com/thesergioandres-projects
- **MongoDB Atlas**: https://cloud.mongodb.com/
- **Guía Completa**: Ver archivo `CORS_TROUBLESHOOTING.md`

---

**Fecha:** 25 de noviembre de 2025
**Problema:** Error 500 por falta de conexión a MongoDB
**Solución:** Configurar `MONGODB_URI` en variables de entorno de Vercel
