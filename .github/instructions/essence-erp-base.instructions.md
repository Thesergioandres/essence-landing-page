---
description: "Usa esta guia cuando implementes o modifiques backend Node/Express, frontend React/Tailwind o reglas de negocio de ventas, comisiones, inventario y seguridad de datos en Essence ERP."
name: "ESSENCE ERP Base Code Instructions"
applyTo: "**"
---

# Instrucciones del Codigo Base: ESSENCE ERP

Estas reglas son una preferencia fuerte del proyecto. Si una excepcion es necesaria, debe quedar documentada y justificada en el cambio.

## 1) Arquitectura y stack

- Backend: Node.js + Express con arquitectura de Casos de Uso (`src/application/use-cases`).
- Prioriza la logica de negocio en repositorios (`src/infrastructure/database/repositories`).
- Frontend: React + Tailwind CSS + Vite.
- Sigue un patron por features en frontend (`inventory`, `sales`, `business`).
- Base de datos: MongoDB.
- Modelos en `server/models` y `server/src/infrastructure/database/models`.

## 2) Reglas de negocio inviolables (blindaje)

- Privacidad financiera:
  - Si un usuario tiene `HIDE_FINANCIAL_DATA: true`, esta prohibido exponer en API o UI los campos `purchasePrice`, `averageCost`, `supplierId` y `profit`.
- Jerarquia de comisiones:
  - Si `isCommissionFixed` es `true`, `customCommissionRate` del perfil del usuario tiene prioridad absoluta sobre gamificacion o niveles de producto.
- Logistica de vaporizadores:
  - Todo movimiento de stock entre sedes o distribuidores debe registrarse en `InventoryMovement`.

## 3) Estandares de codigo

- Naming:
  - Usa nombres descriptivos en espanol para la logica de negocio.
  - Mantiene interoperabilidad con nombres tecnicos ya existentes en ingles (por ejemplo `RegisterSale`, `distributorPricing`).
- UX movil:
  - Evita scroll horizontal con clases como `w-full` y `max-w-screen`.
  - Componentes touch-friendly con area tactil minima de 44px en botones y controles interactivos.
- Seguridad:
  - Las rutas `/admin` y `/god` deben usar middleware de `BusinessContext` y validar rol del usuario.

## 4) Flujos criticos

- Registro de venta:
  - Verifica siempre stock disponible en la sede especifica antes de confirmar.
- Calculo de ganancias:
  - Basalo en Costo Ponderado Promedio (CPP) para mantener precision financiera.

## 5) Checklist rapido antes de cerrar cambios

- Confirma que no se filtren campos financieros si aplica `HIDE_FINANCIAL_DATA`.
- Valida que comision fija gane siempre cuando `isCommissionFixed` sea `true`.
- Verifica que cada transferencia de stock quede en `InventoryMovement`.
- Comprueba que la venta descuenta stock en la sede correcta.
- Asegura que las ganancias usen CPP y no costo historico arbitrario.
