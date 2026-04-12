# Essence ERP

ERP modular Multi-Tenant para operar múltiples negocios con inventario, catálogos, comisiones, garantías y analítica en un solo panel.

Este documento consolida la guía técnica para desarrollo y despliegue, junto con el manual de procesos clave del negocio.

## Tabla de contenido

- [1. Arquitectura técnica](#1-arquitectura-técnica)
- [2. Infraestructura y latencia](#2-infraestructura-y-latencia)
- [3. Estructura del repositorio](#3-estructura-del-repositorio)
- [4. Scripts de utilidad](#4-scripts-de-utilidad)
- [5. Manual de procesos de negocio](#5-manual-de-procesos-de-negocio)
- [6. Guía de usuario por perfil Multi-Tenant](#6-guía-de-usuario-por-perfil-multi-tenant)
- [7. Setup local](#7-setup-local)
- [8. Despliegue en Railway](#8-despliegue-en-railway)
- [9. Operación y troubleshooting](#9-operación-y-troubleshooting)

---

## 1. Arquitectura técnica

## Stack principal

### Frontend

- React 19 + TypeScript
- Vite
- Tailwind CSS
- Framer Motion
- React Router

### Backend

- Node.js + Express
- Arquitectura Hexagonal estricta (Thin Controllers + Use Cases)
- Mongoose sobre MongoDB
- JWT para autenticación y autorización

### Datos y jobs

- MongoDB como base principal
- Redis/BullMQ opcional para trabajos asíncronos y cache

## Patrón general

- Frontend orientado a `feature modules` (`client/src/features/...`).
- Backend organizado por capas (`application`, `domain`, `infrastructure`) y repositorios por agregado.
- Seguridad por middleware de autenticación, contexto de negocio (`x-business-id`) y permisos por módulo/acción.

### Modelo Multi-Tenant y perfiles operativos

- El Tenant es el negocio (`businessId`) y cada request autenticada opera dentro de ese contexto.
- El lenguaje funcional del producto se unifica en perfiles Multi-Tenant: empleados, staff, barberos y vendedores.
- Los perfiles operativos consumen el mismo núcleo transaccional, con permisos diferenciados por membresía y rol.
- El header `x-business-id` y la membresía activa determinan el alcance permitido de lectura/escritura.

### Características críticas de seguridad y consistencia

- **Transacciones ACID de MongoDB:** ventas, pagos, anulaciones, traslados y movimientos críticos de stock se ejecutan dentro de una transacción (`session.startTransaction()`) para garantizar atomicidad y rollback.
- **Escudo Anti-IDOR (Aislamiento por Negocio):** toda lectura/escritura sensible se filtra por `businessId` para evitar cruce de datos entre negocios; el rol GOD mantiene bypass controlado según política de seguridad.

---

## 2. Infraestructura y latencia

## Despliegue actual

- Proyecto en Railway con servicios separados para:
  - `essence-backend`
  - `essence-frontend`
  - `MongoDB`

## Red privada y estrategia de rendimiento

- Backend y MongoDB están co-localizados en la misma plataforma/región de Railway cuando se usa el mismo proyecto/entorno.
- La comunicación backend↔MongoDB viaja por red interna del proveedor (sin exponer puertos públicos para DB), reduciendo salto de red y latencia promedio.
- Estrategias aplicadas para reducir latencia percibida:
  - Co-ubicación de servicios (backend y DB en la misma región).
  - Índices y scripts de optimización (`server/scripts/createIndexes.js`, `server/scripts/optimize_indexes.js`).
  - Filtros de negocio en repositorios para evitar cálculos innecesarios en el cliente.
  - Caching/session helpers en frontend (por ejemplo `requestCache`).

---

## 3. Estructura del repositorio

```text
react-tailwindcss/
├─ client/                  # Frontend React + TypeScript
├─ server/                  # Backend Node/Express + Mongo
├─ scripts/                 # Utilidades puntuales del repo raíz
├─ migracion_erp/           # Dumps/artefactos de migración de datos
├─ deploy/                  # Recursos de despliegue legacy
├─ RAILWAY_DEPLOY.md        # Guía de despliegue Railway
├─ DOCUMENTACION_MAESTRA_ESSENCE.md
├─ BUSINESS_LOGIC_COMPLIANCE_AUDIT.md
└─ README.md                # Este documento
```

---

## 4. Scripts de utilidad

A continuación se listan scripts importantes para operación técnica, migraciones y control de calidad de datos/lógica.

## Comandos principales (raíz)

- Instalar dependencias full stack:
  - `npm run install-all`
- Desarrollo (frontend + backend):
  - `npm run dev`
- Build integral con validación backend:
  - `npm run build`
- Validación sintáctica backend:
  - `npm run validate:backend`

## Comandos principales (server)

- Tests:
  - `cd server && npm test`
  - `cd server && npm run test:clean` ← limpieza/ejecución estable en serie
  - `cd server && npm run test:coverage`
- Verificación previa de configuración de tests:
  - `cd server && node scripts/validate-test-config.js`
- Índices:
  - `cd server && npm run db:indexes`

## Migración y saneamiento de datos

- Migrar stock histórico de bodega en sedes a `warehouseStock`:
  - `cd server && node scripts/migrate_bodega_branch_stock.js`
- Backfill de ajustes contables de garantías:
  - `cd server && node scripts/backfillCustomerWarrantyAdjustments.js --dry-run`
  - `cd server && node scripts/backfillCustomerWarrantyAdjustments.js`
- Validación de integridad de ventas:
  - `cd server && node scripts/validate_sales_integrity.js <BUSINESS_ID> --dry-run`
  - `cd server && node scripts/validate_sales_integrity.js <BUSINESS_ID>`
- Verificación estricta de profit (auditoría contable puntual):
  - `cd server && node scripts/verify_strict_profit.js`

## Recomendación operativa

Ejecutar siempre en este orden para cambios delicados:

1. `--dry-run`
2. Backup
3. Ejecución real
4. Validación posterior (`validate_sales_integrity`, KPIs y reportes)

---

## 5. Manual de procesos de negocio

## 5.1 Módulo de Garantías

El flujo de garantías de cliente se soporta sobre el módulo de defectuosos y registra ticket de referencia (`REF-GAR-xxxxx`).

### Flujo base

1. Buscar venta (`saleId`/`saleGroupId`) con lookup de garantía.
2. Seleccionar ítem vendido, cantidad defectuosa y producto de reemplazo.
3. Elegir origen de reemplazo (`warehouse`, `branch`, `employee`).
4. El sistema descuenta stock del origen seleccionado.
5. Se crea reporte de defectuoso tipo `customer_warranty`.
6. Si aplica, se genera venta complementaria por diferencia de precio (upsell).

### Escenarios financieros (3 casos)

1. **Mismo precio (same price)**
   - `replacementTotal == originalTotal`
   - `priceDifference = 0`
   - `cashRefund = 0`
   - No se crea `upsellSale`.

2. **Upsell**
   - `replacementTotal > originalTotal`
   - `priceDifference > 0`
   - Se crea `upsellSale` asociada al ticket de garantía.
   - Se registra ajuste de profit y evento contable relacionado.

3. **Refund / Downgrade**
   - `replacementTotal < originalTotal`
   - `cashRefund > 0`
   - No se crea `upsellSale`.
   - Queda trazabilidad de devolución en el reporte y metadatos de ajustes.

### Manejo de stock de reemplazo

- **Warehouse:** descuenta `warehouseStock` y `totalStock`.
- **Branch:** descuenta `BranchStock` y actualiza `totalStock` global.
- **Employee:** descuenta `EmployeeStock` del empleado autenticado y actualiza `totalStock`.

### Tribunal de Defectuosos (Admin)

Panel operativo para administración de reportes defectuosos/garantías:

- Confirmar / rechazar reportes.
- Aprobar / rechazar garantías.
- Resolver garantía con resolución final:
  - `scrap` (pérdida)
  - `supplier_warranty` (compensación proveedor)
- Registrar notas administrativas y dejar trazabilidad financiera en `ProfitHistory`.

## 5.2 Módulo de Impersonation (Soporte Admin)

Permite a `admin/super_admin` suplantar a un empleado para soporte operativo sin pedir credenciales al empleado.

### Flujo seguro

1. Admin autenticado inicia suplantación (`/auth/impersonate/:employeeId`).
2. Frontend guarda token original en `localStorage` bajo `admin_original_token`.
3. Se aplica sesión del empleado (nuevo JWT + perfil).
4. Banner visual fijo indica “MODO SOPORTE”.
5. Al revertir, se usa `admin_original_token` para restaurar sesión admin (`/auth/impersonate/revert`).

### Salvaguardas

- Verificación de rol y membresía activa en negocio.
- Reversión solo si `admin_original_token` es válido y pertenece a rol administrativo.
- Separación clara de sesión para evitar mezcla de contextos.

## 5.3 Sistema de Inventario (Jerarquía)

Jerarquía operativa de stock:

1. **Bodega Central**
   - `Product.warehouseStock`
   - Fuente principal para ventas directas admin y reposición.

2. **Sedes**
   - `BranchStock` por `branch + product`
   - Útil para operación descentralizada y reposición local.

3. **Empleados**
   - `EmployeeStock` por `employee + product`
   - Base para ventas del empleado y garantías en modo empleado.

Regla de oro: cada operación debe registrar y devolver stock al origen correcto para preservar simetría de inventario.

---

## 6. Guía de usuario por perfil Multi-Tenant

## 6.1 Admin

Capacidades principales:

- Dashboard de métricas (ventas, margen, gastos, KPIs de operación).
- Gestión multi-negocio (contexto por membresía/empresa).
- Control de inventario global (bodega, sedes, transferencias, productos).
- Tribunal de defectuosos y auditoría de garantías.
- Soporte por impersonation sobre empleados.

Flujos sugeridos diarios:

1. Revisar KPIs y alertas.
2. Verificar quiebres de stock.
3. Validar reportes defectuosos pendientes.
4. Confirmar ventas críticas y conciliaciones.

## 6.2 Empleado / Staff / Barbero / Vendedor

Capacidades principales:

- Registro de ventas de su cartera.
- Consulta de stock asignado.
- Solicitud de garantías para ventas propias.
- Visualización de comisiones, utilidad y desempeño.
- Operación diaria en contexto de su negocio activo (tenant seleccionado).

Restricciones clave:

- Sin acceso a costos sensibles de producto.
- Sin acceso a bodega central en garantías.
- Acceso condicionado por membresía y estado activo.

---

## 7. Setup local

## Prerrequisitos

- Node.js >= 18
- npm >= 9
- MongoDB disponible (local o Atlas)
- (Opcional) Redis

## Instalación

1. Instalar todo:
   - `npm run install-all`
2. Variables de entorno:
   - Copiar `.env.example` (raíz) a `.env` si usas docker-compose legacy.
   - Copiar `server/.env.example` a `server/.env`.
   - Copiar `client/.env.example` a `client/.env`.
3. Ajustar mínimo:
   - `server/.env`: `MONGODB_URI`, `JWT_SECRET`, `ALLOWED_ORIGINS`, `FRONTEND_URL`
   - `client/.env`: `VITE_API_URL`
4. Levantar entorno de desarrollo:
   - `npm run dev`

## Variables de entorno esenciales

### Backend (`server/.env`)

- `MONGODB_URI`
- `JWT_SECRET`
- `NODE_ENV`
- `PORT` (solo local; en Railway lo inyecta plataforma)
- `ALLOWED_ORIGINS`
- `FRONTEND_URL`
- Opcionales: Cloudinary, Redis, VAPID, workers

### Frontend (`client/.env`)

- `VITE_API_URL`

---

## 8. Despliegue en Railway

## Modelo recomendado

Un proyecto Railway con 3 servicios:

- `essence-backend` (root `server`)
- `essence-frontend` (root `client`)
- `MongoDB`

## Deploy automático (GitHub)

- Configurar deploy hooks/secrets:
  - `RAILWAY_BACKEND_DEPLOY_HOOK_URL`
  - `RAILWAY_FRONTEND_DEPLOY_HOOK_URL`
- Cada push a `main` dispara despliegue según pipeline configurado.

## Deploy manual (CLI)

Desde la raíz del repo:

- Backend:
  - `railway up -s essence-backend -c --path-as-root server`
- Frontend:
  - `railway up -s essence-frontend -c --path-as-root client`
- Estado:
  - `railway status --json`

## Variables críticas en producción

- Backend:
  - `MONGODB_URI`
  - `JWT_SECRET`
  - `NODE_ENV=production`
  - `ALLOWED_ORIGINS`
  - `FRONTEND_URL`
  - `BACKUP_WORKER_DISABLED=true` (según estrategia actual)

- Frontend:
  - `VITE_API_URL=https://<backend>.railway.app/api/v2`

---

## 9. Operación y troubleshooting

## Checklist de release

1. `npm run build` (raíz)
2. `cd server && npm run test:clean`
3. Validaciones de integridad/contabilidad según alcance
4. Deploy backend/frontend
5. `railway status --json` en `SUCCESS`

## Problemas comunes

- **Error de negocio por contexto**: validar header `x-business-id` y membresía activa.
- **CORS en producción**: revisar `ALLOWED_ORIGINS` y `FRONTEND_URL`.
- **Descuadre de inventario**: correr scripts de diagnóstico e integridad.
- **KPIs inconsistentes**: revisar estado de pago (`pendiente` vs `confirmado`) y ajustes de garantía.

---

## Documentos complementarios del repo

- [DOCUMENTACION_MAESTRA_ESSENCE.md](DOCUMENTACION_MAESTRA_ESSENCE.md)
- [BUSINESS_LOGIC_COMPLIANCE_AUDIT.md](BUSINESS_LOGIC_COMPLIANCE_AUDIT.md)
- [MASTER_FIX_SUMMARY.md](MASTER_FIX_SUMMARY.md)
- [LOGIC_UPDATE_REPORT.md](LOGIC_UPDATE_REPORT.md)
- [RAILWAY_DEPLOY.md](RAILWAY_DEPLOY.md)

---

Si vas a operar migraciones o ajustes contables en producción, ejecuta siempre primero en entorno controlado con `--dry-run` y respaldo de base de datos.
