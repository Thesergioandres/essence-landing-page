# Script para Crear Tarea Programada de Sincronizacion
# EJECUTAR COMO ADMINISTRADOR

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   CONFIGURACION DE TAREA PROGRAMADA" -ForegroundColor Cyan
Write-Host "   Sincronizacion de Backups desde VPS" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Verificar si se ejecuta como administrador
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "ERROR: Este script debe ejecutarse como Administrador" -ForegroundColor Red
    Write-Host ""
    Write-Host "Instrucciones:" -ForegroundColor Yellow
    Write-Host "1. Clic derecho en PowerShell" -ForegroundColor White
    Write-Host "2. Selecciona 'Ejecutar como administrador'" -ForegroundColor White
    Write-Host "3. Navega a esta carpeta y ejecuta el script de nuevo" -ForegroundColor White
    Write-Host ""
    Read-Host "Presiona Enter para salir"
    exit 1
}

# Configuracion
$TaskName = "SincronizarBackupsVPS"
$TaskDescription = "Descarga backups del VPS cada 6 horas y los borra del servidor para ahorrar espacio"
$ScriptPath = "C:\Users\sergu\OneDrive\Desktop\landing essence\react-tailwindcss\sync-vps-backups.ps1"

# Verificar que el script existe
if (-not (Test-Path $ScriptPath)) {
    Write-Host "ERROR: No se encontro el script: $ScriptPath" -ForegroundColor Red
    Read-Host "Presiona Enter para salir"
    exit 1
}

Write-Host "Configuracion:" -ForegroundColor Yellow
Write-Host "   Nombre: $TaskName"
Write-Host "   Script: $ScriptPath"
Write-Host "   Intervalo: Cada 6 horas"
Write-Host ""

# Eliminar tarea existente si existe
$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Write-Host "Eliminando tarea existente..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

# Crear la accion (ejecutar PowerShell con el script)
$Action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ScriptPath`""

# Crear el trigger (cada 6 horas, empezando 30 min despues de cada backup del VPS)
$Trigger = New-ScheduledTaskTrigger `
    -Once `
    -At (Get-Date).Date.AddMinutes(30) `
    -RepetitionInterval (New-TimeSpan -Hours 6)

# Configurar para repetir indefinidamente
$Trigger.Repetition.Duration = ""

# Configuracion adicional
$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable `
    -MultipleInstances IgnoreNew

# Principal (ejecutar con el usuario actual)
$Principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType S4U `
    -RunLevel Limited

# Crear la tarea
Write-Host "Creando tarea programada..." -ForegroundColor Yellow

try {
    Register-ScheduledTask `
        -TaskName $TaskName `
        -Description $TaskDescription `
        -Action $Action `
        -Trigger $Trigger `
        -Settings $Settings `
        -Principal $Principal `
        -Force | Out-Null
    
    Write-Host ""
    Write-Host "EXITO: Tarea programada creada exitosamente!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Horarios de sincronizacion:" -ForegroundColor Cyan
    Write-Host "   - 00:30 - Despues del backup de medianoche"
    Write-Host "   - 06:30 - Despues del backup de la madrugada"
    Write-Host "   - 12:30 - Despues del backup del mediodia"
    Write-Host "   - 18:30 - Despues del backup de la tarde"
    Write-Host ""
    Write-Host "Los backups se guardaran en:" -ForegroundColor Cyan
    Write-Host "   C:\Users\sergu\OneDrive\Desktop\landing essence\react-tailwindcss\backups\vps-backups\"
    Write-Host ""
    Write-Host "Para ver o modificar la tarea:" -ForegroundColor Yellow
    Write-Host "   1. Abre: Programador de tareas (taskschd.msc)"
    Write-Host "   2. Busca: $TaskName"
    Write-Host ""
    
    # Preguntar si quiere ejecutar ahora
    $runNow = Read-Host "Ejecutar sincronizacion ahora? (S/N)"
    if ($runNow -eq "S" -or $runNow -eq "s") {
        Write-Host ""
        Write-Host "Ejecutando sincronizacion..." -ForegroundColor Yellow
        Start-ScheduledTask -TaskName $TaskName
        Start-Sleep -Seconds 2
        Write-Host "Tarea iniciada - Revisa la ventana que se abrio" -ForegroundColor Green
    }
    
} catch {
    Write-Host "ERROR al crear la tarea: $_" -ForegroundColor Red
    Read-Host "Presiona Enter para salir"
    exit 1
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Presiona Enter para cerrar esta ventana..." -ForegroundColor Gray
Read-Host
