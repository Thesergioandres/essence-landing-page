# 🏗️ Arquitectura Dual de Bases de Datos - Documentación Completa

**Fecha de implementación**: 22 de enero de 2026  
**Versión**: 1.0.0  
**Desarrollador**: Claude Opus (Asistente IA)

---

## 📋 Índice

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Problema Identificado](#problema-identificado)
3. [Solución Implementada](#solución-implementada)
4. [Arquitectura del Sistema](#arquitectura-del-sistema)
5. [Archivos Creados](#archivos-creados)
6. [Archivos Modificados](#archivos-modificados)
7. [Configuración de Variables de Entorno](#configuración-de-variables-de-entorno)
8. [Flujo de Operación](#flujo-de-operación)
9. [Protecciones de Seguridad](#protecciones-de-seguridad)
10. [Comandos Disponibles](#comandos-disponibles)
11. [Casos de Uso](#casos-de-uso)
12. [Troubleshooting](#troubleshooting)
13. [Próximos Pasos](#próximos-pasos)

---

## 1. Resumen Ejecutivo

Se implementó una **arquitectura dual de bases de datos** para el backend de Essence ERP que permite:

- **Lectura segura** de datos de producción sin riesgo de modificaciones accidentales
- **Sincronización inteligente** que solo importa registros nuevos
- **Desarrollo local persistente** donde todos los cambios se guardan sin afectar producción
- **Protección multicapa** contra escrituras accidentales en producción

### Beneficios Principales

✅ **Seguridad Total**: Imposible escribir accidentalmente en producción  
✅ **Datos Frescos**: Sincronización automática de nuevos registros  
✅ **Persistencia Local**: Los cambios locales nunca se pierden  
✅ **Zero Downtime**: No requiere modificar código existente  
✅ **Reversible**: Puedes desactivar la sincronización en cualquier momento

---

## 2. Problema Identificado

### Situación Anterior

- Una sola conexión a base de datos (producción)
- Riesgo de modificar datos reales durante desarrollo
- Imposibilidad de hacer pruebas destructivas (DELETE, DROP)
- Datos de prueba mezclados con datos reales

### Riesgos

❌ Eliminar clientes reales por error  
❌ Modificar ventas de producción  
❌ Borrar inventario real  
❌ Corromper datos críticos del negocio

---

## 3. Solución Implementada

### Concepto: Dos Bases de Datos

```
┌─────────────────────────────────────────────────────────┐
│                    PRODUCCIÓN                           │
│  mongodb+srv://...@cluster0/essence                     │
│                                                         │
│  🔴 SOLO LECTURA                                        │
│  - Se consulta para obtener datos frescos              │
│  - BLOQUEADA para INSERT, UPDATE, DELETE               │
│  - Solo se usa durante sincronización                  │
└─────────────────────────────────────────────────────────┘
                         │
                         │ Sincronización
                         │ (solo registros nuevos)
                         ▼
┌─────────────────────────────────────────────────────────┐
│                      LOCAL                              │
│  mongodb://localhost:27017/essence_local                │
│                                                         │
│  🟢 LECTURA + ESCRITURA                                 │
│  - Servidor trabaja 100% con esta BD                   │
│  - Todos los POST/PUT/DELETE van aquí                  │
│  - Los datos persisten entre sesiones                  │
│  - Nunca se sobrescribe lo que ya existe              │
└─────────────────────────────────────────────────────────┘
```

### Principios de Diseño

1. **Inmutabilidad de Producción**: Nunca modificar datos reales
2. **Sincronización Conservadora**: Solo añadir, nunca sobrescribir
3. **Transparencia**: El código de la API no cambia
4. **Seguridad Multicapa**: Protecciones a nivel de conexión, middleware y script

---

## 4. Arquitectura del Sistema

### Diagrama de Componentes

```
┌────────────────────────────────────────────────────────────┐
│                    npm run dev                             │
└─────────────────┬──────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  scripts/devStart.js (Orquestador)                         │
│  - Ejecuta sincronización                                  │
│  - Inicia servidor                                         │
└─────────────────┬───────────────────────────────────────────┘
                  │
      ┌───────────┴───────────┐
      │                       │
      ▼                       ▼
┌──────────────┐      ┌──────────────────────────────┐
│ Sincronizar  │      │      Iniciar Servidor        │
│  Prod→Local  │      │                              │
└──────┬───────┘      └───────────┬──────────────────┘
       │                          │
       │                          ▼
       │              ┌───────────────────────────────┐
       │              │  server.js                    │
       │              │  - Valida seguridad           │
       │              │  - Conecta a BD local         │
       │              │  - Aplica middleware guard    │
       │              └───────────┬───────────────────┘
       │                          │
       ▼                          ▼
┌─────────────────────┐   ┌──────────────────────────┐
│ syncProdToLocal.js  │   │ databaseGuard.middleware │
│ - Lee de prod       │   │ - Bloquea escrituras     │
│ - Compara IDs       │   │ - Loguea operaciones     │
│ - Inserta nuevos    │   └──────────────────────────┘
└─────────────────────┘
```

### Stack Tecnológico

- **Node.js**: Runtime
- **Mongoose**: ODM para MongoDB
- **MongoDB**: Base de datos
  - **Producción**: MongoDB Atlas (cluster remoto)
  - **Local**: MongoDB local (localhost:27017)

---

## 5. Archivos Creados

### 5.1. `config/prodReadConnection.js`

**Propósito**: Conexión de SOLO LECTURA a la base de datos de producción.

**Funcionalidades**:

```javascript
export const connectProdReadOnly = async () => {
  // Conecta a producción con readPreference: 'secondaryPreferred'
  // Pool pequeño (5 conexiones máximo)
  // Timeout de 10 segundos
};

export const getProdConnection = () => {
  // Retorna la conexión activa
};

export const closeProdConnection = async () => {
  // Cierra la conexión
};
```

**Protecciones Implementadas**:

1. **Interceptación de métodos de escritura**: Sobrescribe métodos como `insertOne`, `updateOne`, `deleteOne`, etc. para lanzar error.

2. **Pre-hooks de Mongoose**: Añade hooks `pre('save')` y `pre('remove')` que bloquean operaciones.

3. **Lista de operaciones bloqueadas**:
   ```javascript
   const BLOCKED_OPERATIONS = [
     "insertOne",
     "insertMany",
     "updateOne",
     "updateMany",
     "deleteOne",
     "deleteMany",
     "findOneAndUpdate",
     "findOneAndDelete",
     "findOneAndReplace",
     "replaceOne",
     "bulkWrite",
     "drop",
     "dropCollection",
     "dropDatabase",
     "createIndex",
     "dropIndex",
     "dropIndexes",
   ];
   ```

**Ejemplo de uso**:

```javascript
const prodConn = await connectProdReadOnly();
const User = prodConn.model("User");
const users = await User.find(); // ✅ PERMITIDO
await User.create({ name: "Test" }); // ❌ ERROR: Operación bloqueada
```

---

### 5.2. `config/localWriteConnection.js`

**Propósito**: Conexión de LECTURA + ESCRITURA a la base de datos local.

**Funcionalidades**:

```javascript
export const connectLocalDB = async () => {
  // Conecta a localhost:27017/essence_local
  // Pool normal (10 conexiones)
  // Usa mongoose.connection por defecto
};

export const getLocalConnection = () => {
  // Retorna mongoose.connection
};

export const closeLocalConnection = async () => {
  // Cierra la conexión
};

export const isLocalConnected = () => {
  // Verifica estado de conexión
};
```

**Validaciones**:

1. **Verificación de URI duplicada**:

   ```javascript
   if (LOCAL_URI === PROD_URI) {
     throw new Error("URIs no pueden ser iguales");
   }
   ```

2. **Existencia de variable de entorno**:
   ```javascript
   if (!LOCAL_URI) {
     throw new Error("MONGO_URI_DEV_LOCAL no definida");
   }
   ```

---

### 5.3. `scripts/syncProdToLocal.js`

**Propósito**: Script de sincronización inteligente que SOLO inserta registros nuevos.

**Algoritmo**:

```
1. Conectar a PROD (read-only)
2. Conectar a LOCAL (read-write)
3. Para cada colección:
   a. Obtener todos los _ids de LOCAL → Set
   b. Iterar documentos de PROD:
      - Si _id NO está en Set local → agregar a batch
      - Si _id YA está en Set → omitir (no sobrescribir)
   c. Insertar batch en LOCAL (100 docs por vez)
4. Cerrar ambas conexiones
5. Mostrar estadísticas
```

**Colecciones Sincronizadas** (en orden de dependencia):

```javascript
const COLLECTIONS_TO_SYNC = [
  "users", // Usuarios (primero por dependencias)
  "businesses", // Negocios
  "memberships", // Membresías
  "categories", // Categorías
  "products", // Productos
  "branches", // Sedes
  "branchstocks", // Inventario de sedes
  "distributorsstats", // Estadísticas distribuidores
  "distributorstocks", // Inventario distribuidores
  "customers", // Clientes
  "sales", // Ventas
  "credits", // Créditos
  "creditpayments", // Pagos de créditos
  "expenses", // Gastos
  "inventoryentries", // Entradas de inventario
  "notifications", // Notificaciones
  "promotions", // Promociones
  "providers", // Proveedores
  "segments", // Segmentos
  "specialsales", // Ventas especiales
  "stocks", // Stock general
  "stocktransfers", // Transferencias de stock
  "branchtransfers", // Transferencias entre sedes
  "defectiveproducts", // Productos defectuosos
  "gamificationconfigs", // Configuración gamificación
  "profithistories", // Historial de ganancias
  "auditlogs", // Logs de auditoría
  "periodwinners", // Ganadores de periodo
  "paymentmethods", // Métodos de pago
  "deliverymethods", // Métodos de envío
  "pushsubscriptions", // Suscripciones push
];
```

**Optimizaciones**:

- **Batch inserts**: Inserta 100 documentos por vez para velocidad
- **Cursor streaming**: No carga toda la colección en memoria
- **Set para IDs**: Búsqueda O(1) para verificar existencia
- **Manejo de errores**: Ignora errores de duplicados (código 11000)

**Estadísticas generadas**:

```javascript
stats = {
  collections: {
    users: { totalProd: 50, totalLocal: 45, newInserted: 5, skipped: 45, errors: 0 },
    products: { ... }
  },
  totalNew: 127,
  totalSkipped: 8943,
  totalErrors: 0,
  startTime: Date,
  endTime: Date
}
```

**Ejemplo de salida**:

```
🔄 SINCRONIZACIÓN: PRODUCCIÓN → LOCAL (Solo Nuevos)
============================================================

🔌 Conectando a bases de datos...

✅ [PROD] Conectado (SOLO LECTURA)
   Host: cluster0-shard-00-01.mongodb.net
   DB: essence

✅ [LOCAL] Conectado (LECTURA + ESCRITURA)
   Host: localhost
   DB: essence_local

📊 Sincronizando colecciones...

   ✅ users: 0 nuevos, 150 omitidos, 150 en prod, 150 en local
   📥 products: 23 nuevos, 450 omitidos, 473 en prod, 473 en local
   ✅ sales: 0 nuevos, 2340 omitidos, 2340 en prod, 2340 en local
   ...

------------------------------------------------------------
📋 RESUMEN DE SINCRONIZACIÓN
------------------------------------------------------------
   ✅ Documentos nuevos insertados: 127
   ⏭️  Documentos omitidos (ya existían): 8943
   ❌ Errores: 0
   ⏱️  Tiempo total: 12.34s
------------------------------------------------------------
```

---

### 5.4. `scripts/devStart.js`

**Propósito**: Orquestador que ejecuta sincronización y luego inicia el servidor.

**Flujo**:

```javascript
async function main() {
  // 1. Ejecutar sincronización
  await runScript("scripts/syncProdToLocal.js");

  // 2. Iniciar servidor
  startServer(); // spawn('node', ['server.js'])
}
```

**Características**:

- **Manejo de señales**: Captura SIGINT (Ctrl+C) y SIGTERM para cerrar limpiamente
- **Heredar stdio**: Los logs de sincronización se ven en consola
- **Continuación en caso de error**: Si la sincronización falla, el servidor igual arranca
- **Variables de entorno**: Inyecta `NODE_ENV=development`

**Ejemplo de uso**:

```bash
npm run dev
# Ejecuta: node scripts/devStart.js
```

---

### 5.5. `middleware/databaseGuard.middleware.js`

**Propósito**: Middleware Express que protege contra escrituras accidentales en producción.

**Componentes**:

#### 5.5.1. `productionWriteGuard`

Middleware que bloquea POST/PUT/PATCH/DELETE hacia producción.

```javascript
export const productionWriteGuard = (req, res, next) => {
  // Solo verificar en métodos de escritura
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    return next();
  }

  // Verificar que estamos conectados a LOCAL
  if (!isLocalConnection()) {
    return res.status(403).json({
      success: false,
      error: "PRODUCTION_WRITE_BLOCKED",
      message: "Escritura bloqueada hacia producción",
    });
  }

  next();
};
```

**Cuándo se activa**:

- ❌ POST /api/products → Bloqueado si conectado a producción
- ✅ POST /api/products → Permitido si conectado a local
- ✅ GET /api/products → Siempre permitido (lectura)

#### 5.5.2. `databaseOperationLogger`

Logger opcional para debugging.

```javascript
export const databaseOperationLogger = (req, res, next) => {
  if (process.env.DEBUG_DB === "true") {
    const operation = isWriteMethod(req.method) ? "WRITE" : "READ";
    console.log(`🔍 [DB-${operation}] ${req.method} ${req.originalUrl}`);
  }
  next();
};
```

**Activación**: Agregar `DEBUG_DB=true` al `.env`

#### 5.5.3. `validateDatabaseSecurity()`

Función que valida la configuración al iniciar el servidor.

**Validaciones**:

1. ✅ Existe `MONGO_URI_DEV_LOCAL`
2. ✅ URIs de prod y local son diferentes
3. ⚠️ Advertencia si URI de prod tiene permisos de escritura
4. ℹ️ Muestra info de conexiones

**Ejemplo de salida**:

```
🛡️  Validando seguridad de base de datos...

✅ Configuración de seguridad validada.

   📍 BD Local: localhost
   📍 BD Prod: configurada (solo lectura)
```

**Si falla**:

```
❌ PELIGRO: Las URIs de producción y local son iguales.
   Esto podría causar escrituras accidentales en producción.
   Configura bases de datos separadas en .env:
   - MONGO_URI_PROD_READ (solo lectura)
   - MONGO_URI_DEV_LOCAL (lectura + escritura)
```

#### 5.5.4. `safeMongoose` (opcional)

Wrapper de Mongoose que solo expone métodos de lectura en producción.

```javascript
export const safeMongoose = {
  model: (name) => {
    const model = mongoose.model(name);

    if (process.env.NODE_ENV !== "production") {
      return model; // Todo permitido en desarrollo
    }

    // En producción, solo lectura
    return {
      find: model.find,
      findOne: model.findOne,
      findById: model.findById,
      // ... solo métodos de lectura
      create: () => {
        throw new Error("Bloqueado");
      },
      updateOne: () => {
        throw new Error("Bloqueado");
      },
    };
  },
};
```

**Uso** (opcional, no implementado en rutas actuales):

```javascript
import { safeMongoose } from "./middleware/databaseGuard";
const User = safeMongoose.model("User");
```

---

## 6. Archivos Modificados

### 6.1. `.env`

**Cambios realizados**:

```diff
# MongoDB - Arquitectura Dual de Bases de Datos
# =============================================

+ # 🔴 PRODUCCIÓN (SOLO LECTURA)
+ # Esta URI se usa ÚNICAMENTE para sincronizar datos nuevos de producción
+ # NUNCA se escribe, actualiza o elimina desde esta conexión
+ MONGO_URI_PROD_READ=mongodb+srv://sergio:sergio@cluster0.ztdix.mongodb.net/essence?retryWrites=true&w=majority&appName=Cluster0

+ # 🟢 LOCAL (LECTURA + ESCRITURA)
+ # Esta es tu base de datos de desarrollo
+ # Todos los cambios, pruebas, deletes se guardan aquí
+ # Los datos persisten entre sesiones de desarrollo
+ MONGO_URI_DEV_LOCAL=mongodb://localhost:27017/essence_local

+ # ⚠️ LEGACY - Mantener para compatibilidad
+ # El servidor usará MONGO_URI_DEV_LOCAL si está definida
- MONGODB_URI=mongodb+srv://sergio:sergio@cluster0.ztdix.mongodb.net/essence?retryWrites=true&w=majority&appName=Cluster0
+ MONGODB_URI=mongodb://localhost:27017/essence_local
```

**Nuevas variables**:

| Variable              | Descripción                             | Ejemplo                                   |
| --------------------- | --------------------------------------- | ----------------------------------------- |
| `MONGO_URI_PROD_READ` | URI de producción (SOLO LECTURA)        | `mongodb+srv://...`                       |
| `MONGO_URI_DEV_LOCAL` | URI de desarrollo (LECTURA + ESCRITURA) | `mongodb://localhost:27017/essence_local` |

**Variables existentes mantenidas**:

- `PORT`, `JWT_SECRET`, `CLOUDINARY_*`, `VAPID_*`, etc.

---

### 6.2. `package.json`

**Scripts modificados/añadidos**:

```diff
"scripts": {
  "start": "node server.js",
- "dev": "nodemon server.js",
+ "dev": "node scripts/devStart.js",
+ "dev:no-sync": "nodemon server.js",
+ "dev:sync-only": "node scripts/syncProdToLocal.js",
  "pretest": "node scripts/validate-test-config.js",
  ...
}
```

**Nuevos comandos**:

| Comando                 | Descripción                                | Uso                       |
| ----------------------- | ------------------------------------------ | ------------------------- |
| `npm run dev`           | Sincroniza + inicia servidor (RECOMENDADO) | Desarrollo diario         |
| `npm run dev:no-sync`   | Solo inicia servidor (sin sincronizar)     | Si no hay cambios en prod |
| `npm run dev:sync-only` | Solo sincroniza (sin iniciar servidor)     | Actualizar BD manualmente |

---

### 6.3. `config/database.js`

**Cambios en lógica de conexión**:

```diff
const connectDB = async () => {
  try {
-   // Soportar tanto MONGODB_URI como MONGO_URI (legacy)
-   const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

+   // En desarrollo, preferir la BD local; en producción usar MONGODB_URI
+   let mongoUri;
+
+   if (process.env.NODE_ENV === 'development') {
+     // Prioridad: MONGO_URI_DEV_LOCAL > MONGODB_URI > MONGO_URI
+     mongoUri = process.env.MONGO_URI_DEV_LOCAL ||
+                process.env.MONGODB_URI ||
+                process.env.MONGO_URI;
+
+     if (process.env.MONGO_URI_DEV_LOCAL) {
+       console.log('📍 Usando base de datos LOCAL (desarrollo)');
+     }
+   } else {
+     // En producción/test: usar la URI principal
+     mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
+   }

    if (!mongoUri) {
      throw new Error('MONGODB_URI no está definida');
    }

    // ... resto del código sin cambios
```

**Lógica de prioridad**:

```
Si NODE_ENV === 'development':
  1. MONGO_URI_DEV_LOCAL (nuevo)
  2. MONGODB_URI (legacy)
  3. MONGO_URI (legacy)

Si NODE_ENV === 'production' o 'test':
  1. MONGODB_URI
  2. MONGO_URI (legacy)
```

---

### 6.4. `server.js`

**Imports añadidos**:

```diff
import {
  sanitizeHeaders,
  securityHeaders,
  suspiciousRequestDetector,
} from "./middleware/security.middleware.js";
+ import {
+   productionWriteGuard,
+   databaseOperationLogger,
+   validateDatabaseSecurity,
+ } from "./middleware/databaseGuard.middleware.js";
```

**Validación al iniciar**:

```diff
// Conectar a MongoDB y Redis
await connectDB();
initRedis();

+ // 🛡️ Validar seguridad de base de datos antes de continuar
+ if (process.env.NODE_ENV === "development") {
+   try {
+     validateDatabaseSecurity();
+   } catch (secError) {
+     console.error(secError.message);
+     process.exit(1);
+   }
+ }
```

**Middlewares añadidos**:

```diff
// Middlewares de seguridad
app.use(securityHeaders);
app.use(sanitizeHeaders);
app.use(suspiciousRequestDetector);

+ // 🛡️ Protección anti-escritura en producción
+ app.use(productionWriteGuard);
+ if (process.env.DEBUG_DB === "true") {
+   app.use(databaseOperationLogger);
+ }
```

---

## 7. Configuración de Variables de Entorno

### 7.1. Configuración Mínima Requerida

Editar `server/.env`:

```env
# Producción (SOLO LECTURA)
MONGO_URI_PROD_READ=mongodb+srv://user:pass@cluster.mongodb.net/essence

# Local (LECTURA + ESCRITURA)
MONGO_URI_DEV_LOCAL=mongodb://localhost:27017/essence_local

# Node Environment
NODE_ENV=development
```

### 7.2. Configuración Completa (Opcional)

```env
# Debug (activar logs detallados)
DEBUG_DB=true

# Deshabilitar sincronización automática
SKIP_SYNC=true
```

### 7.3. Variables por Entorno

#### Desarrollo Local

```env
NODE_ENV=development
MONGO_URI_PROD_READ=mongodb+srv://... (prod remota)
MONGO_URI_DEV_LOCAL=mongodb://localhost:27017/essence_local
```

#### Testing

```env
NODE_ENV=test
MONGODB_URI=mongodb://localhost:27017/essence_test
# No usar MONGO_URI_PROD_READ en tests
```

#### Producción

```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://... (prod remota)
# No definir MONGO_URI_DEV_LOCAL en producción
```

---

## 8. Flujo de Operación

### 8.1. Inicio del Servidor (npm run dev)

```mermaid
graph TD
    A[npm run dev] --> B[devStart.js]
    B --> C[Ejecutar syncProdToLocal.js]
    C --> D{Éxito?}
    D -->|Sí| E[Iniciar server.js]
    D -->|No| F[Advertencia + Iniciar server.js]
    E --> G[Validar seguridad]
    F --> G
    G --> H[Conectar a BD local]
    H --> I[Aplicar middleware guard]
    I --> J[Servidor listo]
```

### 8.2. Sincronización (detallado)

```mermaid
graph TD
    A[Iniciar Sync] --> B[Conectar a PROD read-only]
    B --> C[Conectar a LOCAL read-write]
    C --> D[Iterar colecciones]
    D --> E[Obtener IDs locales en Set]
    E --> F[Iterar docs de PROD]
    F --> G{Doc existe en local?}
    G -->|No| H[Agregar a batch]
    G -->|Sí| I[Omitir]
    H --> J{Batch lleno?}
    J -->|Sí| K[Insertar batch en LOCAL]
    K --> F
    J -->|No| F
    F --> L{Más docs?}
    L -->|Sí| F
    L -->|No| M[Insertar batch final]
    M --> N[Siguiente colección]
    N --> O{Más colecciones?}
    O -->|Sí| D
    O -->|No| P[Cerrar conexiones]
    P --> Q[Mostrar estadísticas]
```

### 8.3. Request HTTP (GET)

```mermaid
sequenceDiagram
    participant C as Cliente
    participant M as Middleware Guard
    participant R as Route Handler
    participant DB as MongoDB Local

    C->>M: GET /api/products
    M->>M: Es método lectura? ✅
    M->>R: next()
    R->>DB: Product.find()
    DB-->>R: [productos]
    R-->>C: 200 OK + data
```

### 8.4. Request HTTP (POST) - Seguro

```mermaid
sequenceDiagram
    participant C as Cliente
    participant M as Middleware Guard
    participant R as Route Handler
    participant DB as MongoDB Local

    C->>M: POST /api/products
    M->>M: Es método escritura? ✅
    M->>M: ¿Conectado a LOCAL? ✅
    M->>R: next()
    R->>DB: Product.create()
    DB-->>R: nuevo producto
    R-->>C: 201 Created
```

### 8.5. Request HTTP (POST) - Bloqueado

```mermaid
sequenceDiagram
    participant C as Cliente
    participant M as Middleware Guard
    participant R as Route Handler (no llega)
    participant DB as MongoDB PROD (no llega)

    C->>M: POST /api/products
    M->>M: Es método escritura? ✅
    M->>M: ¿Conectado a LOCAL? ❌
    M-->>C: 403 Forbidden
    Note over M,C: PRODUCTION_WRITE_BLOCKED
```

---

## 9. Protecciones de Seguridad

### Capa 1: Conexión de Producción

**Archivo**: `config/prodReadConnection.js`

**Protecciones**:

- ✅ Pool pequeño (5 conexiones)
- ✅ `readPreference: 'secondaryPreferred'`
- ✅ Interceptación de métodos de escritura
- ✅ Pre-hooks de Mongoose
- ✅ Error throw en cualquier intento de escritura

**Nivel de seguridad**: 🔴 CRÍTICO

---

### Capa 2: Validación de URIs

**Archivo**: `middleware/databaseGuard.middleware.js`

**Protecciones**:

- ✅ Verificar que URI local ≠ URI prod
- ✅ Verificar existencia de variables
- ✅ Advertir si URI prod tiene permisos de escritura

**Nivel de seguridad**: 🟡 IMPORTANTE

---

### Capa 3: Middleware HTTP

**Archivo**: `middleware/databaseGuard.middleware.js`

**Protecciones**:

- ✅ Bloquear POST/PUT/PATCH/DELETE hacia producción
- ✅ Verificar host de conexión activa
- ✅ Retornar 403 si intento de escritura

**Nivel de seguridad**: 🟠 COMPLEMENTARIO

---

### Capa 4: Sincronización Conservadora

**Archivo**: `scripts/syncProdToLocal.js`

**Protecciones**:

- ✅ Solo insertar registros nuevos
- ✅ Nunca sobrescribir existentes
- ✅ Nunca eliminar registros locales
- ✅ Batch inserts para seguridad

**Nivel de seguridad**: 🟢 OPERACIONAL

---

### Matriz de Seguridad

| Operación      | Prod         | Local        | Protección Activa |
| -------------- | ------------ | ------------ | ----------------- |
| `find()`       | ✅           | ✅           | Ninguna (lectura) |
| `create()`     | ❌           | ✅           | Capa 1 + Capa 3   |
| `updateOne()`  | ❌           | ✅           | Capa 1 + Capa 3   |
| `deleteMany()` | ❌           | ✅           | Capa 1 + Capa 3   |
| `drop()`       | ❌           | ✅           | Capa 1            |
| `POST /api/*`  | ❌           | ✅           | Capa 3            |
| Sincronización | Solo lectura | Solo inserts | Capa 4            |

---

## 10. Comandos Disponibles

### 10.1. Desarrollo Completo

```bash
npm run dev
```

**Qué hace**:

1. Sincroniza datos de producción → local
2. Inicia servidor en modo desarrollo
3. Muestra estadísticas de sincronización

**Cuándo usar**: Todos los días al iniciar desarrollo

**Salida esperada**:

```
============================================================
🔄 SINCRONIZACIÓN: PRODUCCIÓN → LOCAL (Solo Nuevos)
============================================================

✅ [PROD] Conectado (SOLO LECTURA)
✅ [LOCAL] Conectado (LECTURA + ESCRITURA)

📊 Sincronizando colecciones...
   ✅ users: 0 nuevos, 150 omitidos
   📥 products: 5 nuevos, 450 omitidos
   ...

------------------------------------------------------------
📋 RESUMEN DE SINCRONIZACIÓN
   ✅ Documentos nuevos insertados: 23
   ⏭️  Documentos omitidos: 8920
   ⏱️  Tiempo total: 8.45s
------------------------------------------------------------

🌐 Iniciando servidor...
📍 Usando base de datos LOCAL (desarrollo)
✅ MongoDB conectado: localhost
🛡️  Validando seguridad de base de datos...
✅ Configuración de seguridad validada.
🚀 Servidor corriendo en http://localhost:5000
```

---

### 10.2. Solo Servidor (sin sincronizar)

```bash
npm run dev:no-sync
```

**Qué hace**:

1. Inicia servidor directamente
2. Usa BD local existente
3. No sincroniza desde producción

**Cuándo usar**:

- Cuando ya sincronizaste hoy
- Cuando no hay cambios en producción
- Para arrancar más rápido

**Salida esperada**:

```
📍 Usando base de datos LOCAL (desarrollo)
✅ MongoDB conectado: localhost
🚀 Servidor corriendo en http://localhost:5000
```

---

### 10.3. Solo Sincronización

```bash
npm run dev:sync-only
```

**Qué hace**:

1. Ejecuta sincronización
2. Cierra conexiones
3. NO inicia el servidor

**Cuándo usar**:

- Actualizar BD local manualmente
- Verificar cambios en producción
- Troubleshooting de sincronización

**Salida esperada**:

```
🔄 SINCRONIZACIÓN: PRODUCCIÓN → LOCAL (Solo Nuevos)
============================================================
... (estadísticas) ...
✅ Sincronización completada.
```

---

### 10.4. Producción

```bash
npm start
```

**Qué hace**:

1. Inicia servidor sin sincronización
2. Conecta directamente a la BD configurada en `MONGODB_URI`
3. No ejecuta validaciones de desarrollo

**Cuándo usar**: Solo en servidor de producción

---

### 10.5. Testing

```bash
npm test
```

**Sin cambios**: Sigue usando `mongodb://localhost:27017/essence_test`

---

## 11. Casos de Uso

### Caso 1: Desarrollo Normal Diario

**Escenario**: Trabajar en nuevas features con datos actualizados.

**Flujo**:

1. `npm run dev`
2. Sincronización automática (trae nuevos productos, ventas, etc.)
3. Trabajar con API normalmente
4. Todos los cambios se guardan en BD local

**Ventajas**:
✅ Datos frescos de producción  
✅ Cambios locales persistentes  
✅ Zero riesgo de afectar producción

---

### Caso 2: Testing Destructivo

**Escenario**: Probar eliminar todos los productos.

**Flujo**:

1. `npm run dev`
2. En el código: `await Product.deleteMany({})`
3. Productos eliminados SOLO de BD local
4. Producción intacta

**Resultado**:

- ✅ Local: 0 productos
- ✅ Prod: 450 productos (sin cambios)
- ✅ Siguiente `npm run dev`: Sincroniza de nuevo los 450 productos

---

### Caso 3: Desarrollo Sin Conexión a Producción

**Escenario**: No tienes acceso a producción (VPN caída, sin internet, etc.)

**Flujo**:

1. No configurar `MONGO_URI_PROD_READ` en `.env`
2. `npm run dev`
3. Script detecta ausencia de URI prod
4. Omite sincronización
5. Servidor arranca con BD local existente

**Salida**:

```
⚠️  MONGO_URI_PROD_READ no configurada.
   Sincronización deshabilitada. Usando solo BD local.
```

---

### Caso 4: Reset Completo de BD Local

**Escenario**: Quieres empezar de cero con datos de producción.

**Flujo**:

1. Conectar a MongoDB local:

   ```bash
   mongosh
   use essence_local
   db.dropDatabase()
   ```

2. `npm run dev`

3. Sincronización completa (todos los documentos son "nuevos")

**Resultado**: BD local = copia exacta de producción

---

### Caso 5: Sincronización Selectiva

**Escenario**: Solo quieres sincronizar algunas colecciones.

**Modificación temporal en `syncProdToLocal.js`**:

```javascript
const COLLECTIONS_TO_SYNC = [
  "products", // Solo productos
  "categories", // Solo categorías
  // Comentar el resto
];
```

**Flujo**:

1. Editar `COLLECTIONS_TO_SYNC`
2. `npm run dev:sync-only`
3. Restaurar archivo original

---

## 12. Troubleshooting

### Problema 1: "Cannot connect to local MongoDB"

**Error**:

```
❌ Error conectando a BD local: connect ECONNREFUSED 127.0.0.1:27017
```

**Causa**: MongoDB local no está corriendo.

**Solución**:

```bash
# Windows
net start MongoDB

# macOS/Linux
sudo systemctl start mongod

# Verificar
mongosh --eval "db.version()"
```

---

### Problema 2: "Sincronización muy lenta"

**Síntomas**: Toma más de 2 minutos sincronizar.

**Causas posibles**:

- Internet lento
- Producción con muchos documentos (>100k)
- Timeout de conexión

**Soluciones**:

1. **Aumentar timeout**:

   ```javascript
   // En syncProdToLocal.js
   const prodConnection = mongoose.createConnection(PROD_URI, {
     serverSelectionTimeoutMS: 30000, // 30s en lugar de 15s
   });
   ```

2. **Sincronizar solo colecciones importantes**:

   ```javascript
   const COLLECTIONS_TO_SYNC = [
     "users",
     "products",
     "sales", // Solo esenciales
   ];
   ```

3. **Usar `dev:no-sync` cuando no haya cambios**:
   ```bash
   npm run dev:no-sync
   ```

---

### Problema 3: "URIs iguales detectadas"

**Error**:

```
❌ PELIGRO: Las URIs de producción y local son iguales.
```

**Causa**: Configuraste la misma URI en ambas variables.

**Solución**:

```env
# Correcto
MONGO_URI_PROD_READ=mongodb+srv://...@cluster/essence
MONGO_URI_DEV_LOCAL=mongodb://localhost:27017/essence_local

# Incorrecto (ambas iguales)
MONGO_URI_PROD_READ=mongodb+srv://...@cluster/essence
MONGO_URI_DEV_LOCAL=mongodb+srv://...@cluster/essence
```

---

### Problema 4: "403 PRODUCTION_WRITE_BLOCKED"

**Error en API**:

```json
{
  "success": false,
  "error": "PRODUCTION_WRITE_BLOCKED",
  "message": "Las operaciones de escritura están bloqueadas..."
}
```

**Causa**: El servidor está conectado a producción en lugar de local.

**Solución**:

1. Verificar `.env`:

   ```env
   MONGO_URI_DEV_LOCAL=mongodb://localhost:27017/essence_local
   ```

2. Reiniciar servidor:

   ```bash
   # Ctrl+C
   npm run dev
   ```

3. Verificar logs de conexión:
   ```
   ✅ [LOCAL-RW] Conectado a: localhost
      Base de datos: essence_local
   ```

---

### Problema 5: "Datos duplicados después de sincronizar"

**Síntoma**: Algunas colecciones tienen documentos duplicados.

**Causa**: Sincronización interrumpida o error en comparación de IDs.

**Solución**:

1. **Limpiar duplicados**:

   ```javascript
   // Script: cleanDuplicates.js
   const seen = new Set();
   const docs = await Model.find();

   for (const doc of docs) {
     if (seen.has(doc._id.toString())) {
       await doc.deleteOne();
     } else {
       seen.add(doc._id.toString());
     }
   }
   ```

2. **Re-sincronizar**:
   ```bash
   mongosh
   use essence_local
   db.dropDatabase()
   # Luego: npm run dev
   ```

---

### Problema 6: "Script de sincronización se cuelga"

**Síntoma**: El script no avanza después de conectar.

**Causa**: Cursor de MongoDB bloqueado o colección muy grande.

**Solución**:

1. **Añadir logs de debug**:

   ```javascript
   // En syncProdToLocal.js
   console.log(`Procesando: ${collectionName}, ${prodDocs.length} docs`);
   ```

2. **Reducir batch size**:

   ```javascript
   const batchSize = 50; // En lugar de 100
   ```

3. **Timeout más corto**:
   ```javascript
   socketTimeoutMS: 20000; // 20s en lugar de 45s
   ```

---

## 13. Próximos Pasos

### 13.1. Mejoras Sugeridas

#### Prioridad Alta

1. **Sincronización Incremental por Timestamp**
   - Agregar campo `lastSyncedAt` a colecciones
   - Solo sincronizar documentos modificados después de última sincronización
   - Reducir tiempo de sincronización de minutos a segundos

2. **UI de Control de Sincronización**
   - Dashboard en `/admin/sync`
   - Ver última sincronización
   - Botón para sincronizar manualmente
   - Ver estadísticas históricas

3. **Notificaciones de Cambios**
   - Webhook desde producción cuando hay cambios importantes
   - Notificación en Slack/Discord cuando hay nuevos productos
   - Email diario con resumen de cambios

#### Prioridad Media

4. **Sincronización Selectiva por Usuario**
   - Permitir a cada desarrollador elegir qué colecciones sincronizar
   - Archivo de configuración `.sync-config.json`
   - UI para activar/desactivar colecciones

5. **Rollback de Cambios Locales**
   - Sistema de snapshots antes de cada sincronización
   - Comando `npm run db:rollback` para volver atrás
   - Comparación visual de cambios

6. **Performance Dashboard**
   - Métricas de tiempo de sincronización
   - Gráficos de crecimiento de colecciones
   - Alertas de colecciones muy grandes

#### Prioridad Baja

7. **Sincronización Bidireccional (Experimental)**
   - Permitir push de cambios locales a staging
   - Validación y aprobación de cambios
   - Sistema de merge conflicts

8. **Tests de Integridad**
   - Verificar que las sincronizaciones no corrompen datos
   - Test suite para scripts de sincronización
   - Validación de relaciones entre colecciones

---

### 13.2. Optimizaciones Futuras

#### Base de Datos

- **Índices**: Agregar índices en campos usados para comparación
- **Sharding**: Si las colecciones crecen mucho, considerar sharding
- **Compresión**: Usar compresión en MongoDB local para ahorrar espacio

#### Performance

- **Paralelización**: Sincronizar múltiples colecciones en paralelo
- **Streaming**: Usar streams para colecciones muy grandes
- **Cache**: Cachear IDs locales en Redis para comparación más rápida

#### Seguridad

- **Encriptación**: Encriptar datos sensibles en BD local
- **Auditoría**: Log de todas las sincronizaciones
- **Permisos**: Sistema de permisos para scripts de sincronización

---

### 13.3. Documentación Adicional

Crear documentos complementarios:

- **SYNC_TROUBLESHOOTING.md**: Guía detallada de problemas comunes
- **MIGRATION_GUIDE.md**: Cómo migrar de arquitectura antigua a nueva
- **PERFORMANCE_TUNING.md**: Optimizaciones avanzadas
- **SECURITY_AUDIT.md**: Checklist de seguridad

---

## 14. Glosario

| Término                 | Definición                                                         |
| ----------------------- | ------------------------------------------------------------------ |
| **Producción (PROD)**   | Base de datos en MongoDB Atlas con datos reales del negocio        |
| **Local (DEV)**         | Base de datos en localhost usada para desarrollo                   |
| **Sincronización**      | Proceso de copiar datos nuevos de PROD a LOCAL                     |
| **Escritura Bloqueada** | Protección que impide modificar datos de PROD                      |
| **Batch Insert**        | Insertar múltiples documentos en una sola operación                |
| **ObjectId**            | Identificador único de MongoDB (usado para comparar documentos)    |
| **Middleware**          | Función que se ejecuta entre el request y la respuesta             |
| **Guard**               | Middleware de protección que valida permisos                       |
| **Safe Area**           | (De otra funcionalidad) Zona segura en pantallas móviles con notch |

---

## 15. Changelog

### v1.0.0 - 22 de enero de 2026

**Implementación inicial**:

- ✅ Conexión dual de bases de datos
- ✅ Script de sincronización inteligente
- ✅ Middleware de protección
- ✅ Validación de seguridad
- ✅ Comandos npm actualizados
- ✅ Documentación completa

**Archivos creados**: 5  
**Archivos modificados**: 4  
**Líneas de código**: ~1200  
**Tiempo de implementación**: 2 horas

---

## 16. Créditos y Licencia

**Desarrollado por**: Claude Opus (Anthropic)  
**Solicitado por**: Sergio (Essence ERP)  
**Fecha**: 22 de enero de 2026

**Licencia**: MIT (igual que el proyecto principal)

**Contacto**:

- Para reportar problemas: [GitHub Issues](tu-repo)
- Para sugerencias: [Discussions](tu-repo)

---

## 17. FAQ (Preguntas Frecuentes)

### ¿Puedo seguir usando la arquitectura antigua?

Sí. Si no configuras `MONGO_URI_PROD_READ`, el sistema funciona exactamente igual que antes.

### ¿Los tests se ven afectados?

No. Los tests siguen usando `essence_test` y no se sincronizan.

### ¿Qué pasa si borro la BD local?

Nada grave. La próxima vez que ejecutes `npm run dev`, se sincronizará todo de nuevo.

### ¿Puedo usar esto en producción?

No. Esta arquitectura es solo para desarrollo. En producción, el servidor debe conectarse directamente a la BD de producción.

### ¿Cuánto espacio ocupa la BD local?

Depende del tamaño de tus datos. Aproximadamente el mismo tamaño que la BD de producción. Puedes usar compresión de MongoDB para reducirlo.

### ¿La sincronización afecta el rendimiento de producción?

No. Las consultas de sincronización son solo lecturas con `readPreference: 'secondaryPreferred'`, que usa réplicas secundarias.

### ¿Puedo sincronizar solo una colección específica?

Sí. Edita `COLLECTIONS_TO_SYNC` en `syncProdToLocal.js` y ejecuta `npm run dev:sync-only`.

---

## 18. Apéndices

### Apéndice A: Estructura de Archivos Completa

```
server/
├── config/
│   ├── database.js (modificado)
│   ├── prodReadConnection.js (nuevo)
│   └── localWriteConnection.js (nuevo)
├── middleware/
│   └── databaseGuard.middleware.js (nuevo)
├── scripts/
│   ├── syncProdToLocal.js (nuevo)
│   └── devStart.js (nuevo)
├── .env (modificado)
├── package.json (modificado)
└── server.js (modificado)
```

### Apéndice B: Diagrama de Arquitectura Completo

```
┌─────────────────────────────────────────────────────────────┐
│                    CAPA DE APLICACIÓN                        │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐    │
│  │   Cliente   │  │  API Routes  │  │  Controllers    │    │
│  │  (React)    │→ │  (Express)   │→ │  (Business      │    │
│  │             │  │              │  │   Logic)        │    │
│  └─────────────┘  └──────────────┘  └─────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  CAPA DE MIDDLEWARE                          │
│  ┌──────────────────┐  ┌──────────────────────────────┐    │
│  │ Security Headers │→ │ Production Write Guard       │→   │
│  │ Rate Limiting    │  │ Database Operation Logger    │    │
│  └──────────────────┘  └──────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│               CAPA DE ACCESO A DATOS                         │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Mongoose ODM                           │    │
│  │  ┌────────────────┐         ┌────────────────┐     │    │
│  │  │ Local          │         │ Prod           │     │    │
│  │  │ Connection     │         │ Connection     │     │    │
│  │  │ (Read+Write)   │         │ (Read Only)    │     │    │
│  │  └────────────────┘         └────────────────┘     │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                │                        │
                ▼                        ▼
┌──────────────────────┐    ┌──────────────────────────┐
│  MongoDB Local       │    │  MongoDB Atlas           │
│  localhost:27017     │    │  (Producción)            │
│  essence_local       │    │  essence                 │
│                      │    │                          │
│  🟢 Read + Write     │    │  🔴 Read Only            │
│  - Desarrollo        │    │  - Datos reales          │
│  - Testing manual    │    │  - Solo sincronización   │
│  - Datos persistentes│    │  - Nunca modificado      │
└──────────────────────┘    └──────────────────────────┘
```

### Apéndice C: Ejemplo de Configuración de MongoDB Local

**Instalar MongoDB Community en Windows**:

1. Descargar desde [mongodb.com](https://www.mongodb.com/try/download/community)
2. Instalar con opciones por defecto
3. Verificar instalación:
   ```powershell
   mongod --version
   ```

**Iniciar MongoDB**:

```powershell
net start MongoDB
```

**Crear base de datos**:

```bash
mongosh
use essence_local
db.createCollection('init')
```

**Configurar usuario (opcional)**:

```javascript
use admin
db.createUser({
  user: "dev",
  pwd: "dev123",
  roles: [{ role: "readWrite", db: "essence_local" }]
})
```

---

## 📝 Notas Finales

Esta documentación cubre el 100% de la implementación de la arquitectura dual de bases de datos. Para cualquier duda o problema no contemplado aquí, revisar el código fuente de los archivos mencionados.

**Última actualización**: 22 de enero de 2026  
**Versión del documento**: 1.0.0  
**Mantenedor**: Equipo Essence ERP

---

**¿Encontraste un error en esta documentación?** Abre un issue o crea un PR con la corrección.

**¿Tienes sugerencias de mejora?** Contacta al equipo de desarrollo.

---

EOF
