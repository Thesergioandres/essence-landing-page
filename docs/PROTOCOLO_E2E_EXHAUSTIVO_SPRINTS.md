# Protocolo E2E Exhaustivo por Sprints

## 1) Hallazgos criticos previos (evidencia de codigo)

### Critico 1 - Auth contract drift
- Frontend llama endpoints no expuestos en backend:
  - /auth/refresh
  - /auth/logout
  - /business/me/memberships
- Evidencia frontend:
  - client/src/api/axios.ts
  - client/src/features/auth/services/auth.service.ts
- Evidencia backend:
  - server/src/infrastructure/http/routes/auth.routes.v2.js
  - server/src/infrastructure/http/routes/business.routes.v2.js
- Riesgo: refresh fallido silencioso, logout parcial, asignacion businessId fallida para rol god.

### Critico 2 - Notifications y payload mismatch
- Frontend consume:
  - GET /notifications/unread-count
  - DELETE /notifications/cleanup
  - respuesta con notifications[]
- Backend expone:
  - GET /notifications
  - PUT /notifications/:id/read
  - PUT /notifications/read-all
  - DELETE /notifications/:id
  - respuesta principal con data[] y unreadCount
- Evidencia:
  - client/src/features/notifications/services/notification.service.ts
  - client/src/features/notifications/pages/NotificationsPage.tsx
  - server/src/infrastructure/http/routes/notification.routes.v2.js
  - server/src/infrastructure/http/controllers/NotificationController.js
- Riesgo: campana y bandeja de notificaciones con conteo/estructura inconsistente.

### Critico 3 - Push drift (v1 vs v2 mezclado)
- Frontend mezcla rutas:
  - /push/vapid-public-key
  - /push/test
  - /push/preferences
  - /api/push/vapid-key
  - /api/notifications/subscribe
- Backend expone:
  - GET /api/v2/push/vapid-key
  - POST /api/v2/push/subscribe
  - POST /api/v2/push/unsubscribe
  - PUT /api/v2/push/subscriptions/:id/preferences
- Evidencia:
  - client/src/features/notifications/services/notification.service.ts
  - client/src/services/pushNotification.service.ts
  - client/src/components/PushNotificationSettings.tsx
  - server/src/infrastructure/http/routes/pushSubscription.routes.v2.js
- Riesgo: suscripciones no persisten o quedan huerfanas.

### Critico 4 - Issues endpoint mismatch
- Frontend usa PATCH /issues/:id.
- Backend usa PUT /issues/:id/status.
- Evidencia:
  - client/src/features/common/services/common.service.ts
  - server/src/infrastructure/http/routes/issue.routes.v2.js
- Riesgo: estados de incidencia no actualizan en panel operativo.

### Critico 5 - Segmentos y customer points drift
- Frontend segmentos:
  - /customers/segments
- Backend segmentos:
  - /segments
- Frontend customer points:
  - POST /customers/:id/points
  - POST /customers/:id/points/redeem
  - GET /customers/points/config
- Backend customer points:
  - GET /customers/:customerId/points
  - POST /customers/:customerId/points/adjust
  - GET /points/config
- Evidencia:
  - client/src/features/customers/services/customer.service.ts
  - server/src/infrastructure/http/routes/segment.routes.v2.js
  - server/src/infrastructure/http/routes/customerPoints.routes.v2.js
- Riesgo: CRM y fidelizacion con 404/405 en rutas criticas.

### Critico 6 - Branch/Transfer legacy calls sin ruta v2
- Frontend aun invoca:
  - GET /branches/:id/transfers
  - GET /branches/:id/sales-report
  - POST /branches/:id/assign-products
  - POST /branch-transfers/bulk
- Backend v2 no expone esas rutas.
- Evidencia:
  - client/src/features/branches/services/branch.service.ts
  - server/src/infrastructure/http/routes/branch.routes.v2.js
  - server/src/infrastructure/http/routes/branchTransfer.routes.v2.js
- Riesgo: regresiones silenciosas en flujos administrativos de bodega/sedes.

### Alto 7 - Blindaje financiero parcial en middleware global
- En scrub global se limpian purchasePrice, averageCost, supplierId.
- Campos como profit y totalRevenue no se limpian en ese scrub recursivo global.
- Evidencia:
  - server/middleware/financialShield.middleware.js
  - server/utils/financialPrivacy.js
- Riesgo: fuga de datos sensibles en respuestas no especializadas.

### Alto 8 - Comision fija con clamp minimo que puede alterar customCommissionRate
- En modo fixed, CommissionPolicyService aplica minimo 30.
- Regla de negocio declarada: customCommissionRate debe tener prioridad absoluta si isCommissionFixed es true.
- Evidencia:
  - server/src/domain/services/CommissionPolicyService.js
  - server/src/application/use-cases/sales/RegisterSaleUseCase.js
  - server/utils/employeePricing.js
- Riesgo: pago de comision distinto al pactado para empleados.

## 2) Plan E2E por sprints (tabla de 5 columnas)

| Sprint | Objetivo de riesgo | Casos E2E a ejecutar | Datos y entorno | Criterio de salida |
|---|---|---|---|---|
| S1 Contratos Auth y Sesion | Cortar fallas de login/sesion por drift de endpoints | Login admin/empleado/god; reload con sesion; expiracion token; flujo sin refresh endpoint; logout local y servidor; seleccion negocio para god | Usuarios seed por rol, negocio activo, token expirado simulado, cabecera x-business-id | 0 llamadas a endpoints inexistentes de auth; redirecciones consistentes; sesion estable sin loops 401 |
| S2 Contratos Notificaciones y Push | Asegurar mensajeria en tiempo real sin rutas legacy | Carga de bandeja, marcar leida individual/todas, eliminar, conteo no leidas derivado de GET /notifications, alta/baja suscripcion push, actualizar preferencias por subscriptionId | Service worker habilitado, navegador con permiso granted/denied, datos de notificaciones de prueba | 100% operaciones notificacion/push sin 404/405; payloads normalizados sin undefined en UI |
| S3 Contratos Incidencias, Segmentos y Puntos | Blindar flujos de soporte y CRM | Crear issue, listar, actualizar estado con PUT /:id/status; CRUD segmentos via /segments; balance/historial/ajuste de puntos y lectura de config | Cliente test con creditos, segmentos iniciales, usuario con permisos clients read/update | Sin errores de metodo/ruta; consistencia de estados issue y saldos de puntos |
| S4 Ventas y Comisiones | Garantizar matematica de comisiones y stock por origen | Venta desde bodega/sede/empleado; rechazo por stock insuficiente por origen; confirmacion de pago; comparacion comision fija vs variable; validar no intervencion gamificacion cuando fixed | Empleado A fixed, empleado B variable, productos con stock en 3 orígenes, metodos de pago y credito | Formula de comision cumple regla de negocio; stock decrementa exactamente en origen correcto |
| S5 Privacidad Financiera | Verificar scrub API + ocultamiento UI por rol/permisos/flags | Mismo endpoint consultado por admin, empleado, usuario con HIDE_FINANCIAL_DATA; assert de null/0 en purchasePrice, averageCost, supplierId, profit, totalRevenue; tabla y cards UI con candado/ocultacion | Usuarios por rol y membresias con combinaciones de permisos, dataset con costos visibles en origen | Ningun actor no autorizado recibe costos sensibles en API ni en UI |
| S6 Logistica Dispatch e Inventario | Validar cadena PENDIENTE -> DESPACHADO -> RECIBIDO e InventoryMovement | Crear solicitud, despachar con guia/evidencia obligatoria, recepcion autorizada (destino o god), rechazo de actor no autorizado, validacion inTransitQuantity y quantity, auditoria movimientos DISPATCH_OUTBOUND/RECEIVED | Empleado destino, empleado tercero, usuario god, productos con warehouseStock suficiente | Transicion de estado estricta, trazabilidad completa y sin descuadres de inventario |
| S7 Permisos, Features y Multi-tenant | Evitar escalamiento de privilegios y fugas cross-tenant | Matrix de roles (admin/super_admin/god/empleado/viewer) por modulo y accion; rutas /admin y /god con middleware de contexto; acceso denegado cuando falta feature o permiso | 2 negocios aislados, usuarios cruzados, permisos granulares por membresia | Ningun acceso cruzado entre tenants; respuestas 403 correctas y sin exposicion de datos |
| S8 Resiliencia, UX movil y PWA | Sostener operacion en campo con red inestable | Timeouts, aborts, 500 forzados, reconexion; smoke offline PWA; pruebas touch-first (controles >=44px), sin scroll horizontal, rendimiento de pantallas criticas | Profiles Playwright desktop/mobile, throttling red, service worker activo | UI estable en errores de red, recuperacion sin bloqueo, experiencia movil operable |

## 3) Matriz de contratos API priorizados (tabla de 5 columnas)

| Modulo | Frontend actual | Backend v2 real | Impacto | Prioridad |
|---|---|---|---|---|
| Auth | /auth/refresh, /auth/logout, /business/me/memberships | /auth/login, /auth/register, /auth/select-plan, /auth/profile, /auth/impersonate/:id, /auth/impersonate/revert, /business/my-memberships | Sesion inestable y bootstrap incompleto para god | P0 |
| Notifications | /notifications/unread-count, /notifications/cleanup, espera notifications[] | /notifications retorna data[] + unreadCount; sin unread-count ni cleanup dedicados | Campana y pagina con conteos/datos inconsistentes | P0 |
| Push | /push/vapid-public-key, /push/test, /push/preferences, /api/notifications/subscribe | /push/vapid-key, /push/subscribe, /push/unsubscribe, /push/subscriptions/:id/preferences | Suscripciones no guardadas o no actualizables | P0 |
| Issues | PATCH /issues/:id | PUT /issues/:id/status | No cierra/reabre incidencias | P1 |
| Segmentos y Puntos | /customers/segments, /customers/:id/points, /customers/:id/points/redeem, /customers/points/config | /segments, /customers/:id/points, /customers/:id/points/history, /customers/:id/points/adjust, /points/config | Falla CRM/fidelizacion y pantallas asociadas | P1 |
| Branch/Transfers | /branches/:id/transfers, /branches/:id/sales-report, /branches/:id/assign-products, /branch-transfers/bulk | Branch v2 sin esas rutas; branch-transfers v2 sin /bulk | Funciones administrativas legacy con 404 | P2 |

## 4) Estrategia de ejecucion

1. Ejecutar S1-S3 antes de cualquier regression funcional amplia.
2. Ejecutar S4-S6 con datos semilla controlados y snapshots de inventario antes/despues.
3. Cerrar con S7-S8 para hardening de seguridad, movilidad y resiliencia.
4. Gate de salida global: cero fallos P0, cero fugas financieras, y cero descuadres de stock en escenarios de despacho/venta.

## 5) Reuso de suite actual y huecos

### Suite existente aprovechable
- client/e2e/01-authentication.spec.ts
- client/e2e/03-inventory.spec.ts
- client/e2e/04-sales.spec.ts
- client/e2e/07-golden-flow.spec.ts
- client/e2e/09-master-regression.spec.ts

### Huecos que se deben agregar
- Contratos API explicitos (status code + shape) por modulo drift.
- Casos negativos de permisos por modulo/accion y feature flag.
- Validacion automatizada de scrub financiero en multiples endpoints.
- Cadena completa Dispatch con auditoria de InventoryMovement.

## 6) Nota operativa

No se ejecutaron tests en esta etapa. Este documento define el plan de ejecucion y la priorizacion para QA/Engineering.
