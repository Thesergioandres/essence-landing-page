# 🔄 CONFIGURAR BACKUP AUTOMÁTICO DIARIO (Windows)

## ✅ Sistema de Backups Locales

Los backups se guardan en: `react-tailwindcss/backups/`

### 📦 Características:

- ✅ **Sin herramientas externas** - No requiere mongodump
- ✅ **Backups en JSON** - Fáciles de leer y restaurar
- ✅ **Limpieza automática** - Mantiene últimos 30 días
- ✅ **Metadata incluida** - Fecha, cantidad de datos, etc.

---

## 🤖 Configurar Backup Automático Diario

### Opción 1: Task Scheduler de Windows (Recomendado)

#### Paso 1: Abrir Task Scheduler

```
1. Presiona Win + R
2. Escribe: taskschd.msc
3. Presiona Enter
```

#### Paso 2: Crear Nueva Tarea

```
1. Click en "Crear tarea básica"
2. Nombre: "Backup Essence Diario"
3. Descripción: "Backup automático de base de datos"
4. Click "Siguiente"
```

#### Paso 3: Configurar Desencadenador

```
1. Selecciona: "Diariamente"
2. Click "Siguiente"
3. Hora: 02:00 AM (o la que prefieras)
4. Cada: 1 día
5. Click "Siguiente"
```

#### Paso 4: Acción

```
1. Selecciona: "Iniciar un programa"
2. Click "Siguiente"
3. Programa/script:
   C:\Users\sergu\OneDrive\Desktop\landing essence\react-tailwindcss\server\scripts\backup-auto.bat

4. Click "Siguiente"
5. Click "Finalizar"
```

#### Paso 5: Configuración Adicional (Importante)

```
1. En la lista de tareas, busca "Backup Essence Diario"
2. Click derecho → Propiedades
3. En "General":
   - ✅ Marcar: "Ejecutar tanto si el usuario inició sesión como si no"
   - ✅ Marcar: "Ejecutar con los privilegios más altos"

4. En "Condiciones":
   - ❌ Desmarcar: "Iniciar solo si el equipo está conectado"

5. Click "Aceptar"
```

---

### Opción 2: Script PowerShell (Alternativa)

Crea `backup-scheduler.ps1`:

```powershell
# Configurar tarea programada
$action = New-ScheduledTaskAction -Execute "C:\Users\sergu\OneDrive\Desktop\landing essence\react-tailwindcss\server\scripts\backup-auto.bat"

$trigger = New-ScheduledTaskTrigger -Daily -At 2am

Register-ScheduledTask -Action $action -Trigger $trigger -TaskName "Backup Essence Diario" -Description "Backup automático de base de datos"
```

Ejecutar como Administrador:

```powershell
powershell -ExecutionPolicy Bypass -File backup-scheduler.ps1
```

---

## 📋 Uso Manual

### Crear Backup Manualmente:

```bash
cd server
node scripts/backup-database.js
```

### Ver Backups Disponibles:

```bash
cd server
node scripts/restore-backup.js
```

Salida ejemplo:

```
📋 Backups disponibles:

1. backup-2026-01-06
   📅 6/1/2026, 20:30:15
   📊 15 colecciones, 324 documentos
   💾 1.25 MB

2. backup-2026-01-05
   📅 5/1/2026, 02:00:12
   📊 15 colecciones, 312 documentos
   💾 1.18 MB
```

### Restaurar Backup:

```bash
cd server
node scripts/restore-backup.js backup-2026-01-06
```

---

## 🗂️ Estructura de Backups

```
backups/
├── backup-2026-01-06/
│   ├── metadata.json          # Info del backup
│   ├── users.json             # Usuarios
│   ├── businesses.json        # Negocios
│   ├── sales.json             # Ventas
│   ├── products.json          # Productos
│   └── ...                    # Demás colecciones
│
├── backup-2026-01-05/
│   └── ...
│
└── backup-2026-01-04/
    └── ...
```

---

## 🔍 Verificar Tarea Programada

### Ver si está activa:

```powershell
Get-ScheduledTask -TaskName "Backup Essence Diario"
```

### Ver último resultado:

```powershell
Get-ScheduledTaskInfo -TaskName "Backup Essence Diario" | Select LastRunTime, LastTaskResult
```

### Ejecutar manualmente:

```powershell
Start-ScheduledTask -TaskName "Backup Essence Diario"
```

### Desactivar:

```powershell
Disable-ScheduledTask -TaskName "Backup Essence Diario"
```

### Eliminar:

```powershell
Unregister-ScheduledTask -TaskName "Backup Essence Diario" -Confirm:$false
```

---

## 💡 Recomendaciones

1. **Probar primero manualmente**:

   ```bash
   cd server
   node scripts/backup-database.js
   ```

2. **Verificar que la carpeta backups existe**:

   ```bash
   dir ..\backups
   ```

3. **Primera ejecución programada**:

   - Ejecuta manualmente la tarea desde Task Scheduler
   - Verifica que el backup se creó correctamente
   - Revisa los logs en Task Scheduler → Historial

4. **Monitorear espacio en disco**:

   - Cada backup ocupa ~1-5 MB dependiendo de los datos
   - Se mantienen 30 días = ~30-150 MB máximo

5. **Backup adicional en la nube** (opcional):
   - Sube la carpeta `backups/` a OneDrive/Google Drive
   - Usa herramientas como SyncBackFree

---

## 🚨 Recuperación de Datos

Si pierdes datos:

1. **Detener el servidor**
2. **Listar backups disponibles**:
   ```bash
   node scripts/restore-backup.js
   ```
3. **Restaurar el más reciente**:
   ```bash
   node scripts/restore-backup.js backup-2026-01-06
   ```
4. **Verificar datos restaurados**
5. **Reiniciar servidor**

---

## ✅ Checklist de Configuración

- [ ] Ejecutar backup manual para probar
- [ ] Verificar que se creó en carpeta `backups/`
- [ ] Configurar tarea programada en Task Scheduler
- [ ] Ejecutar tarea manualmente desde Task Scheduler
- [ ] Verificar que se creó backup automático
- [ ] Esperar al día siguiente para confirmar que funciona
- [ ] (Opcional) Configurar sincronización con OneDrive
