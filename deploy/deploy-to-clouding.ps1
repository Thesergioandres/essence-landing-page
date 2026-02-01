Param(
    [Parameter(Mandatory=$true)]
    [string]$RemoteFull
)


# Extraer host y ruta usando regex para evitar errores con ':' en rutas Windows
if ($RemoteFull -match "^([^:]+):(.+)$") {
    $remoteHost = $matches[1]
    $remoteDir = $matches[2]
} else {
    Write-Error "Formato esperado: user@host:/ruta/destino"
    exit 1
}

Write-Output "Sincronizando a $($remoteHost):$remoteDir ..."
# Usar robocopy en Windows o rsync desde WSL; intentamos rsync si está disponible
if (Get-Command rsync -ErrorAction SilentlyContinue) {
    rsync -av --delete --exclude node_modules --exclude .git --exclude client/node_modules --exclude server/node_modules . $RemoteFull
} else {
    Write-Warning "rsync no encontrado: copia manual con SCP/WinSCP/PowerShell Remoting"
}

Write-Output "Ejecutando docker compose en remoto..."
ssh $remoteHost "cd '$remoteDir' && docker compose pull || true && docker compose up -d --build"

Write-Output "Despliegue completado."


