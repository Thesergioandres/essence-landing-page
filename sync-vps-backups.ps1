# ============================================================
# Script de Sincronización Automática de Backups desde VPS
# ============================================================
# Este script descarga los backups del VPS y los borra del servidor
# para ahorrar espacio en el VPS
#
# USO MANUAL:
#   .\sync-vps-backups.ps1
#
# CONFIGURAR TAREA PROGRAMADA (ver instrucciones abajo)
# ============================================================

$ErrorActionPreference = "Stop"

# Ruta del proyecto
$ProjectPath = Split-Path -Parent $PSScriptRoot
$ServerPath = Join-Path $ProjectPath "server"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   SINCRONIZACIÓN DE BACKUPS DESDE VPS" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📅 Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host "📂 Proyecto: $ProjectPath"
Write-Host ""

# Cambiar al directorio del servidor
Set-Location $ServerPath

# Ejecutar sincronización
Write-Host "🔄 Iniciando sincronización..." -ForegroundColor Yellow
Write-Host ""

try {
    node scripts/sync-backups-from-vps.js
    
    Write-Host ""
    Write-Host "✅ Sincronización completada exitosamente" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "❌ Error durante la sincronización: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# ============================================================
# INSTRUCCIONES PARA CONFIGURAR TAREA PROGRAMADA EN WINDOWS
# ============================================================
#
# Para que este script se ejecute automáticamente cada 6 horas
# (cuando el VPS hace un backup), sigue estos pasos:
#
# 1. Abre el Programador de Tareas de Windows:
#    - Presiona Win + R
#    - Escribe: taskschd.msc
#    - Presiona Enter
#
# 2. Crea una nueva tarea:
#    - Clic en "Crear tarea básica..."
#    - Nombre: "Sincronizar Backups VPS"
#    - Descripción: "Descarga backups del VPS cada 6 horas"
#
# 3. Configurar el desencadenador:
#    - Selecciona "Diariamente"
#    - Hora de inicio: 00:30 (30 min después del backup del VPS)
#    - Repetir cada: 1 día
#
# 4. Para que se repita cada 6 horas:
#    - Después de crear la tarea, haz doble clic en ella
#    - Ve a la pestaña "Desencadenadores"
#    - Edita el desencadenador
#    - Marca "Repetir tarea cada:" y pon "6 horas"
#    - "Durante:" selecciona "Indefinidamente"
#
# 5. Configurar la acción:
#    - Programa: powershell.exe
#    - Argumentos: -ExecutionPolicy Bypass -File "C:\Users\sergu\OneDrive\Desktop\landing essence\react-tailwindcss\sync-vps-backups.ps1"
#
# 6. Condiciones:
#    - Desmarca "Iniciar solo si el equipo tiene alimentación de CA"
#    - Marca "Activar el equipo para ejecutar esta tarea" (opcional)
#
# 7. Configuración:
#    - Marca "Ejecutar tarea a petición"
#    - Marca "Si la tarea programada no se ejecuta, volver a intentarla cada:"
#      y pon "1 hora" durante "6 horas"
#
# ============================================================
