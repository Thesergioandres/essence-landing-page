# 🔄 Sistema de Sincronización Automática de Backups

Este documento explica cómo funciona la sincronización automática de backups entre el VPS y tu computadora local.

## 📋 ¿Qué hace?

1. **VPS crea backups** cada 6 horas automáticamente
2. **Tu PC descarga** los backups del VPS
3. **Se borran del VPS** después de descargar (para ahorrar espacio en el servidor)
4. **Solo ocupan espacio en tu PC**, no en el VPS

## 🔧 Configuración

### Credenciales (ya configuradas en `.env`)

```env
VPS_HOST=93.189.89.195
VPS_PORT=22
VPS_USERNAME=root
VPS_PASSWORD=serra1707
VPS_BACKUP_PATH=/home/deploy/app/backups
DELETE_VPS_BACKUPS=true   # Borrar del VPS después de descargar
```

## 🚀 Uso

### Sincronizar Manualmente

```powershell
# Desde el directorio del proyecto
cd server
node scripts/sync-backups-from-vps.js
```

### Sincronización Automática (Tarea Programada)

Para que tu PC descargue backups automáticamente cada 6 horas:

1. **Abre el Programador de Tareas** (Win + R → `taskschd.msc`)

2. **Crear tarea básica:**

   - Nombre: `Sincronizar Backups VPS`
   - Desencadenador: Diariamente a las 00:30

3. **Configurar repetición cada 6 horas:**

   - Editar la tarea → Desencadenadores → Editar
   - Marcar "Repetir tarea cada: **6 horas**"
   - Durante: **Indefinidamente**

4. **Acción:**

   - Programa: `powershell.exe`
   - Argumentos: `-ExecutionPolicy Bypass -File "C:\Users\sergu\OneDrive\Desktop\landing essence\react-tailwindcss\sync-vps-backups.ps1"`

5. **Condiciones:**
   - ❌ Desmarcar "Iniciar solo si el equipo tiene alimentación de CA"

## 🎯 Cómo Funciona

### Flujo de Sincronización

```
VPS                          PC Local
═══                          ════════

🕐 00:00 → Backup creado
           backup-2026-01-08T00-00/

🕐 00:05 ← Script de sincronización se ejecuta
           📥 Descarga backup nuevo
           ✅ Guardado en backups/vps-backups/

🕐 06:00 → Backup creado
           backup-2026-01-08T06-00/

🕐 06:05 ← Script de sincronización se ejecuta
           📥 Descarga solo el nuevo backup
           ✅ Guardado en backups/vps-backups/
```

### Detección Inteligente

El script:

- ✅ Lista los backups en el VPS
- ✅ Compara con los backups locales ya descargados
- ✅ Descarga **solo los nuevos**
- ✅ No descarga backups duplicados

### Estructura de Carpetas

```
backups/
├── backup-2026-01-08T00-00/       ← Backups LOCALES
├── backup-2026-01-08T06-00/       ← (de tu PC)
└── vps-backups/                   ← Backups del VPS
    ├── backup-2026-01-08T00-00/   ← Descargados del servidor
    ├── backup-2026-01-08T06-00/
    └── backup-2026-01-08T12-00/
```

## ⚙️ Gestión de la Tarea Programada

### Ver Estado

```powershell
Get-ScheduledTask -TaskName "Essence-VPS-Backup-Sync"
```

### Ejecutar Manualmente

```powershell
Start-ScheduledTask -TaskName "Essence-VPS-Backup-Sync"
```

### Deshabilitar

```powershell
Disable-ScheduledTask -TaskName "Essence-VPS-Backup-Sync"
```

### Habilitar

```powershell
Enable-ScheduledTask -TaskName "Essence-VPS-Backup-Sync"
```

### Eliminar

```powershell
Unregister-ScheduledTask -TaskName "Essence-VPS-Backup-Sync"
```

## 🔐 Seguridad

### Recomendaciones:

1. **Usa clave SSH en lugar de password:**

   ```powershell
   # Generar clave SSH (si no tienes)
   ssh-keygen -t rsa -b 4096 -C "tu-email@ejemplo.com"

   # Copiar clave al VPS
   ssh-copy-id usuario@tu-vps.com
   ```

2. **El archivo `.env` NO se sube a GitHub** (está en `.gitignore`)

3. **Permisos de la clave SSH:**
   - Windows: No requiere permisos especiales
   - Linux/Mac: `chmod 600 ~/.ssh/id_rsa`

## 📊 Logs y Monitoreo

### Ver Logs de la Tarea Programada:

```powershell
Get-ScheduledTaskInfo -TaskName "Essence-VPS-Backup-Sync"
```

### Ejecución Manual con Logs:

```bash
cd server
node scripts/sync-backups-from-vps.js
```

Ejemplo de salida:

```
═══════════════════════════════════════════════════════════
🔄 SINCRONIZACIÓN DE BACKUPS DESDE VPS
═══════════════════════════════════════════════════════════

✅ Conectado al VPS

📋 Listando backups en el VPS...
   📦 8 backups encontrados en el VPS
   💾 5 backups ya descargados localmente

🆕 3 backup(s) nuevo(s) por descargar:
   • backup-2026-01-08T12-00
   • backup-2026-01-08T18-00
   • backup-2026-01-09T00-00

📥 Descargando: backup-2026-01-08T12-00
   📄 34 archivos encontrados
   ✅ 34/34 archivos descargados
   ✅ Backup completo: backup-2026-01-08T12-00

[... repite para cada backup ...]

═══════════════════════════════════════════════════════════
✅ Sincronización completada exitosamente
═══════════════════════════════════════════════════════════
📂 Backups guardados en: C:\Users\...\backups\vps-backups
```

## 🚨 Solución de Problemas

### Error: "Configuración SSH incompleta"

- ✅ Verifica que `VPS_HOST` y `VPS_USERNAME` estén configurados en `.env`

### Error: "Connection refused"

- ✅ Verifica el puerto SSH (generalmente 22)
- ✅ Verifica que el firewall permita conexiones SSH
- ✅ Intenta conectarte manualmente: `ssh usuario@vps-host`

### Error: "Authentication failed"

- ✅ Verifica el password o la ruta de la clave SSH
- ✅ Verifica que la clave SSH tenga los permisos correctos

### No descarga backups nuevos

- ✅ Verifica que `VPS_BACKUP_PATH` sea correcto
- ✅ Ejecuta manualmente para ver logs detallados

## 📝 Notas Importantes

- ⏰ La sincronización se ejecuta **cada 6 horas** (alineada con el worker de backups)
- 💾 Los backups del VPS se guardan en `backups/vps-backups/`
- 🔄 Solo descarga backups nuevos (no duplica)
- 🌐 Requiere conexión a Internet
- ⚡ La primera sincronización puede tardar dependiendo del tamaño de los backups

## 🎯 Resumen

| Aspecto           | Detalle                                     |
| ----------------- | ------------------------------------------- |
| **Frecuencia**    | Cada 6 horas (alineada con backups del VPS) |
| **Método**        | SSH/SFTP                                    |
| **Carpeta Local** | `backups/vps-backups/`                      |
| **Detección**     | Solo descarga backups nuevos                |
| **Automático**    | Sí, con tarea programada de Windows         |

---

**✨ Con esta configuración, tendrás copias sincronizadas de todos los backups del VPS en tu PC local automáticamente.**
