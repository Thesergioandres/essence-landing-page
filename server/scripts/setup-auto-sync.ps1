# Script para Configurar Sincronización Automática de Backups
# Crea una tarea programada en Windows que descarga backups del VPS cada 6 horas

$TaskName = "Essence-VPS-Backup-Sync"
$ScriptPath = "$PSScriptRoot\sync-backups-from-vps.js"
$NodePath = (Get-Command node).Source
$WorkingDirectory = Split-Path $PSScriptRoot -Parent

Write-Host "`n" + ("=" * 60)
Write-Host "⚙️  CONFIGURACIÓN DE SINCRONIZACIÓN AUTOMÁTICA"
Write-Host ("=" * 60)

# Verificar que el script existe
if (!(Test-Path $ScriptPath)) {
    Write-Host "`n❌ Error: No se encuentra el script de sincronización" -ForegroundColor Red
    Write-Host "   Ruta esperada: $ScriptPath"
    exit 1
}

Write-Host "`n📋 Configuración:"
Write-Host "   Tarea: $TaskName"
Write-Host "   Script: $ScriptPath"
Write-Host "   Node: $NodePath"
Write-Host "   Directorio: $WorkingDirectory"

# Crear acción
$Action = New-ScheduledTaskAction `
    -Execute $NodePath `
    -Argument "`"$ScriptPath`"" `
    -WorkingDirectory $WorkingDirectory

# Crear trigger (cada 6 horas)
$Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 6)

# Configuración de la tarea
$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable

# Verificar si la tarea ya existe
$ExistingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

if ($ExistingTask) {
    Write-Host "`n⚠️  La tarea ya existe. ¿Deseas reemplazarla? (S/N)" -ForegroundColor Yellow
    $Response = Read-Host
    
    if ($Response -eq "S" -or $Response -eq "s") {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "   ✅ Tarea anterior eliminada"
    } else {
        Write-Host "   ❌ Operación cancelada"
        exit 0
    }
}

# Registrar la tarea
try {
    Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $Action `
        -Trigger $Trigger `
        -Settings $Settings `
        -Description "Sincroniza backups del VPS de Essence cada 6 horas" `
        -ErrorAction Stop
    
    Write-Host "`n✅ Tarea programada creada exitosamente" -ForegroundColor Green
    Write-Host "`n📅 Programación:"
    Write-Host "   • Se ejecutará cada 6 horas"
    Write-Host "   • Primera ejecución: inmediata"
    Write-Host "   • Se ejecutará incluso si hay batería baja"
    Write-Host "   • Requiere conexión a Internet"
    
    Write-Host "`n🔧 Comandos útiles:"
    Write-Host "   • Ver estado: Get-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Cyan
    Write-Host "   • Ejecutar ahora: Start-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Cyan
    Write-Host "   • Deshabilitar: Disable-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Cyan
    Write-Host "   • Eliminar: Unregister-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Cyan
    
    Write-Host "`n⚠️  IMPORTANTE:" -ForegroundColor Yellow
    Write-Host "   Configura las variables SSH en el archivo .env:"
    Write-Host "   VPS_HOST=tu-servidor.com"
    Write-Host "   VPS_USERNAME=root"
    Write-Host "   VPS_PASSWORD=tu-password"
    Write-Host "   VPS_BACKUP_PATH=/home/app/backups"
    
    Write-Host "`n🧪 ¿Deseas ejecutar una sincronización de prueba ahora? (S/N)" -ForegroundColor Yellow
    $TestResponse = Read-Host
    
    if ($TestResponse -eq "S" -or $TestResponse -eq "s") {
        Write-Host "`n🔄 Iniciando sincronización de prueba..."
        Start-ScheduledTask -TaskName $TaskName
        Write-Host "✅ Tarea iniciada. Revisa los logs para ver el resultado."
    }
    
} catch {
    Write-Host "`n❌ Error al crear la tarea programada:" -ForegroundColor Red
    Write-Host "   $_"
    Write-Host "`n💡 Intenta ejecutar PowerShell como Administrador"
    exit 1
}

Write-Host "`n" + ("=" * 60)
Write-Host "✅ CONFIGURACIÓN COMPLETADA"
Write-Host ("=" * 60) + "`n"
