# 🛡️ PROTECCIÓN DE DATOS - SISTEMA DE BACKUPS

## ✅ Implementaciones de Seguridad

### 1. **Sistema de Backups Automáticos**

#### Scripts Disponibles:

```bash
# Crear backup manual
cd server
node scripts/backup-database.js
```

#### Características:

- ✅ Backups automáticos antes de operaciones peligrosas (solo en producción)
- ✅ Limpieza automática de backups antiguos (mantiene 7 días)
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
