# 🛡️ PROTECCIÓN MULTICAPA - GUÍA COMPLETA

## ✅ TODAS LAS PROTECCIONES IMPLEMENTADAS

### 📊 Estado: 7 CAPAS DE SEGURIDAD ACTIVAS

---

## CAPA 1: Separación de Bases de Datos

**Archivos:**

- `server/.env` → BD de producción: `essence`
- `server/.env.test` → BD de test: `essence_test`

**Protección:**

- Tests NUNCA tocan la BD de producción
- Cada entorno tiene su propia BD aislada

---

## CAPA 2: Validación Pre-Test Automática

**Archivo:** `server/scripts/validate-test-config.js`

**Se ejecuta ANTES de cada test** (script `pretest` en package.json)

**Validaciones:**

- ✅ NODE_ENV debe ser "test"
- ✅ BD debe contener "\_test" en el nombre
- ✅ Archivo .env.test debe existir
- ✅ Puerto debe ser diferente a producción (5001)

**Resultado:** Si falla alguna validación, los tests NO se ejecutan.

```bash
npm test
# Primero ejecuta: validate-test-config.js
# Solo si pasa, ejecuta los tests
```

---

## CAPA 3: Protección en Código de Conexión

**Archivo:** `server/config/database.js`

**Validaciones en runtime:**

```javascript
// Bloquea producción con BD de test
if (NODE_ENV === "production" && uri.includes("_test")) {
  throw Error("BD de test en producción");
}

// Bloquea tests con BD de producción
if (NODE_ENV === "test" && !uri.includes("_test")) {
  throw Error("Tests deben usar BD de test");
}
```

---

## CAPA 4: Protección en Script de Limpieza

**Archivo:** `server/cleanAllDatabase.js`

**Triple verificación:**

1. ❌ No ejecutar si NODE_ENV=production
2. ❌ No ejecutar si BD no contiene "\_test"
3. ❌ No ejecutar si no es localhost

**Ejemplo:**

```bash
# Esto FALLARÁ si no es BD de test
node cleanAllDatabase.js
```

---

## CAPA 5: Middleware de Protección de Datos

**Archivo:** `server/middleware/dataProtection.middleware.js`

**Funcionalidad:**

- Intercepta operaciones `deleteMany({})` en producción
- Bloquea borrados masivos sin condiciones específicas
- Permite solo borrados con filtros explícitos

**Código:**

```javascript
// ❌ BLOQUEADO en producción
Model.deleteMany({});

// ✅ PERMITIDO en producción (tiene condiciones)
Model.deleteMany({ userId: "123" });
```

---

## CAPA 6: Variable de Control

**Variable:** `ALLOW_DANGEROUS_OPERATIONS`

**Configuración:**

- `.env` (desarrollo): `true` - Permite borrar datos
- `.env.test` (test): `true` - Permite limpiar entre tests
- **Producción**: `false` - Bloquea operaciones peligrosas

---

## CAPA 7: Protección en Git

**Archivo:** `server/.gitignore`

**Archivos protegidos:**

```
.env
.env.local
.env.production
.env.test         # Configuraciones sensibles
backups/          # Backups no se suben
*.pem, *.key      # Claves privadas
```

**Beneficio:** Evita exponer credenciales o subir configs incorrectas.

---

## 🔍 VERIFICACIÓN COMPLETA

### Probar Protecciones:

```bash
cd server

# 1. Validar configuración de test
node scripts/validate-test-config.js
# Debe mostrar: ✅ Configuración de tests validada

# 2. Intentar limpiar BD sin ser test (debe fallar)
NODE_ENV=production node cleanAllDatabase.js
# Debe mostrar: ❌ ERROR: No puede ejecutarse en producción

# 3. Ejecutar tests (debe usar essence_test)
npm test
# Debe mostrar: 🧪 Modo TEST: usando base de datos essence_test
```

---

## 📋 CHECKLIST ANTES DE PRODUCCIÓN

- [ ] Verificar que `.env` en producción tiene:

  - `NODE_ENV=production`
  - `MONGODB_URI=...essence` (SIN \_test)
  - `ALLOW_DANGEROUS_OPERATIONS=false`

- [ ] Configurar backups automáticos (ver `BACKUP_LOCAL.md`)

- [ ] Verificar que `.env.test` NO está en el servidor de producción

- [ ] Probar que scripts de limpieza fallan en producción

- [ ] Confirmar logs de conexión: debe decir "essence" no "essence_test"

---

## 🚨 SI AÚN ASÍ SE BORRAN DATOS

Si a pesar de todas estas protecciones se pierden datos:

### Pasos Inmediatos:

1. **DETENER** todos los servicios (servidor y tests)
2. **REVISAR** logs para identificar qué causó el borrado
3. **RESTAURAR** desde backup más reciente:
   ```bash
   cd server
   node scripts/restore-backup.js
   ```

### Investigar:

```bash
# Ver logs de MongoDB
grep "deleteMany\|drop\|remove" logs/*.log

# Ver qué proceso está corriendo
ps aux | grep node

# Ver conexiones activas a MongoDB
mongosh --eval "db.currentOp()"
```

---

## 💡 MEJORES PRÁCTICAS

### En Desarrollo:

✅ Usar BD local o de desarrollo
✅ Crear backups antes de cambios grandes
✅ Probar scripts en entorno de test primero

### En Tests:

✅ SIEMPRE ejecutar `npm test` (no comandos manuales)
✅ Verificar logs que confirmen uso de `essence_test`
✅ Revisar el pretest antes de ejecutar

### En Producción:

✅ NO ejecutar scripts de limpieza manualmente
✅ NO ejecutar tests en servidor de producción
✅ Backups automáticos activos 24/7
✅ Monitorear logs de operaciones deleteMany
✅ Acceso limitado a BD (solo lectura para la mayoría)

---

## 📞 RESUMEN EJECUTIVO

**7 capas de protección implementadas:**

1. ✅ BDs separadas (essence vs essence_test)
2. ✅ Script de validación pre-test automático
3. ✅ Validación en código de conexión
4. ✅ Protección triple en cleanAllDatabase.js
5. ✅ Middleware que bloquea deleteMany en producción
6. ✅ Variable ALLOW_DANGEROUS_OPERATIONS
7. ✅ .gitignore protege archivos sensibles

**Resultado:** Es prácticamente imposible borrar la BD de producción accidentalmente.

**Única forma de borrar producción:** Hacerlo manualmente desde MongoDB Atlas con credenciales de administrador.
