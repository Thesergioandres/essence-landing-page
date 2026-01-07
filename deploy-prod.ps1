# Script para desplegar a producción
# Ejecutar desde la raíz del proyecto

Write-Host "🔨 Construyendo frontend..." -ForegroundColor Cyan
cd client
npm run build

Write-Host "✅ Build completado!" -ForegroundColor Green
Write-Host ""
Write-Host "📦 Ahora sube la carpeta client/dist al servidor:" -ForegroundColor Yellow
Write-Host "   scp -r client/dist/* usuario@93.189.89.195:/usr/share/nginx/html/" -ForegroundColor White
Write-Host ""
Write-Host "O si usas Docker:" -ForegroundColor Yellow
Write-Host "   1. Copia client/dist al servidor" -ForegroundColor White
Write-Host "   2. Ejecuta: docker-compose down && docker-compose up -d" -ForegroundColor White
