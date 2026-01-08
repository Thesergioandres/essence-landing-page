# 🛡️ PROTECCIÓN DE DATOS - SISTEMA DE BACKUPS

## 🚨 INCIDENTE CRÍTICO - 8 ENERO 2026

### ❌ PROBLEMA IDENTIFICADO Y RESUELTO

**Los tests unitarios estaban borrando la base de datos de producción.**

#### Causa Raíz:

1. No existía `.env.test` → Tests usaban la BD de producción (`essence`)
2. Tests ejecutan `deleteMany({})` en todas las colecciones
3. Resultado: **73 documentos eliminados de 34 colecciones**

#### ✅ Soluciones Implementadas:

1. **Base de datos separada para tests**

   - Creado: `server/.env.test` → usa `essence_test` (NO `essence`)
   - Scripts de test fuerzan `NODE_ENV=test`

2. **Protecciones en código**

   - `database.js` valida que tests NO usen BD de producción
   - `database.js` valida que producción NO use BD de test
   - Logs explícitos cuando se usa BD de test

3. **Comandos actualizados**
   ```bash
   npm test        # Ahora usa essence_test
   npm run dev     # Siempre usa essence
   npm start       # Siempre usa essence
   ```

#### ⚠️ CRÍTICO - Verificar Antes de Ejecutar Tests:

```bash
# Debe mostrar: "🧪 Modo TEST: usando base de datos essence_test"
cd server && npm test 2>&1 | grep "MongoDB conectado"

# Si conecta a "essence" (sin _test), ¡DETENER INMEDIATAMENTE!
```

#### 🛡️ Capas de Protección Adicionales Implementadas:

1. **Script de validación pre-test** (`pretest`)

   - Verifica NODE_ENV=test
   - Confirma que BD contiene "\_test"
   - Valida que .env.test existe
   - **Los tests NO se ejecutan si falla alguna validación**

2. **Protección en cleanAllDatabase.js**

   - Bloquea ejecución si NODE_ENV=production
   - Requiere que BD contenga "\_test" o sea localhost
   - Triple verificación antes de borrar datos

3. **Middleware de protección de datos**

   - Intercepta operaciones `deleteMany({})` en producción
   - Bloquea borrados masivos sin condiciones
   - Logs de auditoría de operaciones peligrosas

4. **Variable ALLOW_DANGEROUS_OPERATIONS**

   - Debe estar en `false` en producción
   - Controla si se permiten operaciones de borrado masivo
   - Agregada a .env y .env.test

5. **.gitignore actualizado**
   - .env.test no se sube al repositorio
   - Protege backups/ de subirse accidentalmente
   - Excluye archivos de seguridad (.pem, .key, .crt)

---

## ✅ Implementaciones de Seguridad

### 1. **Sistema de Backups Automáticos** 🆕

#### ⏰ Backups Programados (Nuevo Worker):

El servidor ahora ejecuta backups automáticos cada **6 horas**:

| Hora  | Backup               |
| ----- | -------------------- |
| 00:00 | ✅ Backup automático |
| 06:00 | ✅ Backup automático |
| 12:00 | ✅ Backup automático |
| 18:00 | ✅ Backup automático |

**Retención:** Los backups se mantienen por **30 días**. Los más antiguos se eliminan automáticamente.

**Ubicación:** `backups/backup_YYYY-MM-DD_HH-MM-SS/`

#### Configuración:

```bash
# Para DESHABILITAR backups automáticos (no recomendado):
BACKUP_WORKER_DISABLED=true

# El worker está HABILITADO por defecto
# Se desactiva automáticamente en modo test (NODE_ENV=test)
```

#### Scripts Disponibles:

```bash
# Crear backup manual
cd server
node scripts/backup-database.js

# El worker también puede dispararse manualmente desde código:
import { triggerManualBackup } from "./jobs/backup.worker.js";
await triggerManualBackup();
```

#### Características:

- ✅ **Backups automáticos cada 6 horas** (nuevo worker)
- ✅ **Retención de 30 días** con limpieza automática
- ✅ Backups manuales bajo demanda
- ✅ Backups antes de operaciones peligrosas (solo en producción)
- ✅ Export/Import de colecciones específicas
- ✅ Restauración desde backup

### 2. **Protección de Operaciones Peligrosas**

#### Operaciones Protegidas:

- ❌ **DELETE Business** - Ahora requiere:
  - Rol GOD exclusivamente
  - Header de confirmación: `x-confirm-operation: true`
  - Backup automático previo (en producción)

#### Ejemplo de uso seguro:

```javascript
// Frontend
await api.delete(`/business/${id}`, {
  headers: {
    "x-confirm-operation": "true",
  },
});
```

### 3. **Configuración de MongoDB Atlas (Recomendado)**

Si usas MongoDB Atlas:

1. **Habilitar Snapshots Automáticos**:

   - Ve a tu cluster → Backup
   - Activa "Continuous Backup" o "Cloud Backup"
   - Configura retención: 7-30 días

2. **Configurar Alertas**:
   - Operaciones masivas de delete
   - Cambios en colecciones críticas
   - Uso de CPU/Memoria anómalo

### 4. **Variables de Entorno**

Agregar a `.env`:

```bash
# Backups automáticos en producción
NODE_ENV=production

# Habilitar protección de operaciones peligrosas
PROTECT_DANGEROUS_OPS=true
```

### 5. **Herramientas MongoDB (Requeridas para backups locales)**

#### Windows:

```powershell
# Descargar de: https://www.mongodb.com/try/download/database-tools
# Instalar y agregar al PATH
```

#### Linux/Mac:

```bash
sudo apt install mongodb-database-tools
# o
brew install mongodb-database-tools
```

### 6. **Buenas Prácticas Implementadas**

✅ **Soft Delete** - Considerar implementar:

```javascript
// En lugar de eliminar, marcar como deleted
business.deletedAt = new Date();
business.status = "deleted";
await business.save();
```

✅ **Audit Logs Mejorados** - Ya implementado:

- Registro de todas las operaciones críticas
- Tracking de quien hizo qué y cuándo

✅ **Confirmación Doble**:

- Operaciones peligrosas requieren header explícito
- Solo usuarios GOD pueden ejecutarlas

### 7. **Restaurar desde Backup**

```bash
# Listar backups disponibles
ls server/backups/

# Restaurar backup específico
node -e "
import('./utils/backup.js').then(b =>
  b.restoreBackup('./backups/backup-2026-01-06T20-00-00')
)
"
```

## 📋 Checklist de Protección

- [x] Sistema de backups automáticos
- [x] Middleware de protección para deletes
- [x] Restricción por rol GOD
- [x] Confirmación explícita requerida
- [x] Logs de operaciones peligrosas
- [ ] Configurar MongoDB Atlas backups (manual)
- [ ] Configurar alertas de email (manual)
- [ ] Implementar soft delete (opcional)

## 🚨 En Caso de Pérdida de Datos

1. **Detener el servidor inmediatamente**
2. **No ejecutar más operaciones**
3. **Revisar backups disponibles**: `ls server/backups/`
4. **Restaurar el último backup válido**
5. **Verificar integridad de datos**
6. **Investigar causa raíz en logs**

## 💡 Recomendaciones Adicionales

1. **Backups programados** (cron job):

```bash
# Agregar a crontab
0 2 * * * cd /path/to/server && node scripts/backup-database.js
```

2. **Backups en la nube** (S3, Google Cloud Storage)
3. **Réplicas de base de datos** (MongoDB Replica Set)
4. **Monitoreo 24/7** (Datadog, New Relic)
