# 🔧 Verificación y Solución - Error 500 MongoDB

## ✅ Estado Actual

- ✅ CORS funcionando correctamente
- ✅ Backend desplegado y corriendo
- ❌ Error 500: MongoDB no conecta

## 🔍 Análisis de Variables de Entorno

### Variables Actuales en Vercel Backend:

```env
✅ MONGODB_URI=mongodb+srv://thsergioandres:Serra_1707@cluster0.ztdix.mongodb.net/essence?retryWrites=true&w=majority&appName=Cluster0
✅ MONGO_URI=mongodb+srv://thsergioandres:Serra_1707@cluster0.ztdix.mongodb.net/essence?retryWrites=true&w=majority&appName=Cluster0
✅ JWT_SECRET=essence_production_jwt_2024_very_secure_key_change_this_123456
✅ NODE_ENV=production
❌ FRONTEND_URL=https://essence-landing-page-fvp2.vercel.app/api (INCORRECTO)
```

### Problemas Detectados:

1. **FRONTEND_URL está mal configurado:**

   - Actual: `https://essence-landing-page-fvp2.vercel.app/api`
   - Correcto: `https://essence-landing-page.vercel.app`
   - (Debe ser la URL del FRONTEND sin `/api`)

2. **Posible problema con MongoDB:**
   - El error 500 indica que MongoDB no conecta
   - La cadena de conexión parece correcta
   - Usuario: `thsergioandres`
   - Contraseña: `Serra_1707`
   - Cluster: `cluster0.ztdix.mongodb.net`

## 🎯 Solución Paso a Paso

### Paso 1: Corregir FRONTEND_URL

1. Ve a Vercel → Proyecto backend → **Settings** → **Environment Variables**
2. Busca `FRONTEND_URL`
3. Clic en **⋮** → **Edit**
4. Cambia el valor a:
   ```
   https://essence-landing-page.vercel.app
   ```
   (Sin `/api` al final)
5. Guarda

### Paso 2: Verificar MongoDB Atlas

#### A. Verificar Network Access

1. Ve a https://cloud.mongodb.com/
2. Inicia sesión
3. En el menú izquierdo, clic en **Network Access**
4. Verifica que esté la IP: **`0.0.0.0/0`** (permite todas las IPs)
5. Si no está, agrégala:
   - Clic en **"Add IP Address"**
   - Clic en **"Allow Access from Anywhere"**
   - Confirm

#### B. Verificar Database Access (Usuario)

1. En MongoDB Atlas, clic en **Database Access**
2. Busca el usuario: `thsergioandres`
3. Verifica que:
   - Estado: **Active** (no disabled)
   - Privilegios: **Atlas admin** o **Read and write to any database**
4. Si no existe o está mal, créalo de nuevo:
   - Clic en **"Add New Database User"**
   - Username: `thsergioandres`
   - Password: `Serra_1707`
   - Database User Privileges: **Read and write to any database**
   - Add User

#### C. Probar Cadena de Conexión

La cadena se ve correcta, pero verifica que:

- La contraseña **`Serra_1707`** sea exacta (case-sensitive)
- No tenga caracteres especiales que necesiten encoding
- Si tiene `_` está bien, pero si tiene `@` `#` `%` necesitan ser encodeados

### Paso 3: Verificar Logs en Vercel

1. Ve a Vercel → Proyecto backend
2. Clic en **Deployments**
3. Clic en el último deployment (el más reciente)
4. Scroll hacia abajo hasta **"Function Logs"** o clic en **"View Function Logs"**
5. Refresca el frontend para generar una nueva petición
6. Busca en los logs:

**Si ves:**

```
✅ MongoDB conectado: cluster0.ztdix.mongodb.net
```

→ MongoDB funciona, el problema es otro

**Si ves:**

```
❌ Error conectando a MongoDB: ...
```

→ Lee el mensaje de error específico y compártelo

**Posibles errores:**

- `Authentication failed` → Contraseña incorrecta
- `IP not whitelisted` → Falta agregar 0.0.0.0/0 en Network Access
- `MONGODB_URI no está definida` → Variable no cargó (redesplegar)

### Paso 4: Redesplegar Después de Corregir FRONTEND_URL

1. Después de cambiar `FRONTEND_URL`
2. Ve a **Deployments**
3. Último deployment → **⋮** → **Redeploy**
4. Confirm
5. Espera 1-2 minutos

### Paso 5: Probar de Nuevo

1. **Probar backend directamente:**

   ```
   https://essence-landing-page-fvp2.vercel.app/
   ```

   Debe responder con version 2.0.0

2. **Probar endpoint de productos:**

   ```
   https://essence-landing-page-fvp2.vercel.app/api/products
   ```

   - ✅ Si ves `[]` (array vacío) → ¡MongoDB funciona! No hay productos aún
   - ✅ Si ves productos → ¡Todo funciona!
   - ❌ Si ves error 500 → Revisar logs

3. **Probar frontend:**
   ```
   https://essence-landing-page.vercel.app/
   ```
   - Debe cargar sin errores de CORS
   - Si hay productos en la BD, deben aparecer

## 🔍 Debugging Avanzado

### Probar Conexión MongoDB Localmente

1. Abre PowerShell
2. Ve a la carpeta del proyecto:

   ```powershell
   cd "c:\Users\sergu\OneDrive\Desktop\landing essence\react-tailwindcss\server"
   ```

3. Abre el archivo `.env`:

   ```powershell
   notepad .env
   ```

4. Actualiza con la misma cadena de producción:

   ```env
   MONGODB_URI=mongodb+srv://thsergioandres:Serra_1707@cluster0.ztdix.mongodb.net/essence?retryWrites=true&w=majority&appName=Cluster0
   JWT_SECRET=essence_production_jwt_2024_very_secure_key_change_this_123456
   ```

5. Corre el servidor localmente:

   ```powershell
   npm start
   ```

6. Si conecta localmente, el problema es específico de Vercel
7. Si NO conecta localmente, el problema es MongoDB Atlas (Network Access o usuario)

## 📋 Checklist de Verificación

### MongoDB Atlas

- [ ] Cluster activo y corriendo
- [ ] Usuario `thsergioandres` existe y está activo
- [ ] Contraseña `Serra_1707` es correcta
- [ ] Network Access permite `0.0.0.0/0`
- [ ] Database User Privileges: Read and write

### Variables de Entorno en Vercel

- [ ] `MONGODB_URI` configurada correctamente
- [ ] `MONGO_URI` configurada correctamente (respaldo)
- [ ] `FRONTEND_URL` = `https://essence-landing-page.vercel.app` (SIN `/api`)
- [ ] `JWT_SECRET` configurado
- [ ] `NODE_ENV=production` configurado

### Despliegue

- [ ] Backend redesplegado después de cambiar FRONTEND_URL
- [ ] Logs muestran "MongoDB conectado"
- [ ] `/api/products` responde (aunque sea array vacío)
- [ ] Frontend carga sin error 500

## 🎯 Acciones Inmediatas

1. **CORREGIR `FRONTEND_URL` en Vercel** (es lo más urgente)
2. **Verificar Network Access en MongoDB Atlas** (debe tener 0.0.0.0/0)
3. **Verificar logs en Vercel** para ver el error exacto de MongoDB
4. **Redesplegar backend** después de corregir FRONTEND_URL
5. **Probar `/api/products`** para confirmar MongoDB

---

**Próximo paso:** Corrige `FRONTEND_URL` y comparte los logs de Vercel para ver el error exacto de MongoDB.
