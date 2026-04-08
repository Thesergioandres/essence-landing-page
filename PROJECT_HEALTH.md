# PROJECT HEALTH - Essence ERP v2

Fecha: 2026-04-02
Autor: Super (auditoria + saneamiento)

## 1) Estado Actual de Arquitectura

### Backend (Node + Express + Mongo)

- Arquitectura v2 por capas (casos de uso + repositorios + controladores HTTP) en `server/src`.
- Middleware centralizado para seguridad y contexto de negocio:
  - `protect` (auth)
  - `businessContext` (multi-tenant por negocio)
  - `requireFeature` (flags por modulo)
  - `requirePermission` (permisos granulares por `{ module, action }`)
- Repositorios de negocio en `server/src/infrastructure/database/repositories`.
- Modelos canónicos v2 en `server/src/infrastructure/database/models`.

### Frontend (React + Tailwind)

- Ruteo protegido por rol + redirecciones operativo/admin.
- Modo privado financiero en vistas clave (`hideFinancialData`) con render condicional.
- Catalogo PDF white-label usando branding de negocio y campos seguros.

## 2) Modulos Blindados y Correcciones Aplicadas

### 2.1 Permisos v2 (fix critico)

Se migraron llamadas legacy `requirePermission("...")` al contrato actual `requirePermission({ module, action })` en rutas v2:

- `provider.routes.v2.js`
- `specialSale.routes.v2.js`
- `business.routes.v2.js`
- `branchTransfer.routes.v2.js`
- `customer.routes.v2.js`
- `audit.routes.v2.js`
- `notification.routes.v2.js`
- `issue.routes.v2.js`

Impacto:

- Se eliminan 403 falsos provocados por `module/action` indefinidos en middleware.
- Se estabiliza acceso operativo segun matriz de permisos real.

### 2.2 Blindaje de analytics avanzado (privacy scrubbing)

Se reforzo `AdvancedAnalyticsRepository` para que, cuando `hideFinancialData === true`:

- Campos de profit/costo derivados se devuelvan en `0`.
- `totalInventoryValue` y `value` (inventario visual) se devuelvan en `0`.
- No se rompa el shape de respuesta.

Tambien se propago el scope de privacidad en controller a:

- `getInventoryStatus`
- `getLowStockVisual`

### 2.3 Trazabilidad de transferencias entre sedes

Se normalizo `BranchTransferRepository` al esquema vigente:

- Antes: `transferredBy`
- Ahora: `requestedBy` + `approvedBy`
- Se actualizan `populate(...)` en listados y detalle.

Resultado:

- Toda transferencia completada registra claramente quien solicito y quien aprobo.

### 2.4 Limpieza de modelos duplicados

- Se migraron imports de backend para usar modelos v2 canonicos (`server/src/infrastructure/database/models`).
- Se eliminaron wrappers duplicados ya sin referencias:
  - `server/models/Product.js`
  - `server/models/Sale.js`
  - `server/models/User.js`

## 3) Deuda Tecnica Residual (priorizada)

### Alta

- Revisar si `issue.routes.v2.js` debe operar con `businessContext` obligatorio (multi-tenant estricto) o mantenerse como ruta global de soporte.

### Media

- Consolidar schema de `Business` entre:
  - `server/models/Business.js`
  - `server/src/infrastructure/database/models/Business.js`
    (hoy tienen divergencia de campos de plan/limites).
- Eliminar comentarios de ruido tecnico en `AnalyticsRepository.js` y normalizar imports/documentacion interna.

### Baja

- Reducir logs de consola no esenciales en servicios de analytics frontend para entorno productivo.
- Estandarizar tareas de test para Windows (scripts npm con `NODE_ENV` portable).

## 4) Riesgos Controlados

- Permisos v2 ya alineados al middleware: riesgo de bloqueo falso significativamente reducido.
- Scrubbing financiero reforzado en analytics avanzadas: menor riesgo de exposicion de metricas derivadas de costo.
- Trazabilidad de transferencias normalizada: mejor auditoria operativa.

## 5) Proximo Paso Recomendado

1. Ejecutar bateria de tests backend enfocada en rutas v2 y analytics.
2. Ejecutar build frontend + smoke test de dashboard avanzado en modo privado.
3. Cerrar decision de arquitectura para `issues` (global vs multi-tenant estricto).
