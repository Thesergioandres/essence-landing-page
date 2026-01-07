#!/bin/bash
# Verificar qué URL usa el build en producción

echo "🔍 Verificando configuración API en producción..."
echo ""

# Buscar baseURL en los archivos JS del servidor
ssh usuario@93.189.89.195 "grep -r 'baseURL' /usr/share/nginx/html/assets/*.js | head -n 1"

echo ""
echo "Debería mostrar: baseURL:\"/api\""
echo "Si muestra puerto 5000, necesitas actualizar el build"
