---
description: "Guía arquitectónica y de seguridad estricta para Essence ERP. Úsala SIEMPRE al implementar o modificar backend (Arquitectura Hexagonal), frontend (Clean Architecture), reglas de negocio, ventas, y seguridad de inquilinos (Tenants)."
name: "ESSENCE ERP - Enterprise Base Instructions"
applyTo: "**/*.{js,ts,tsx,jsx}"
---

# CONSTITUCIÓN DEL CÓDIGO: ESSENCE ERP

Estas reglas son dogmas del proyecto. Cualquier desviación o excepción debe ser documentada, justificada explícitamente y envuelta en un comentario `// TODO: Tech Debt`.

## 1. 🏗️ Arquitectura Estricta (Backend Hexagonal & Frontend Clean)

- **Backend (Node.js + Express):**
  - **Prohibido:** Lógica de negocio o consultas a MongoDB directamente en los Controladores (`src/infrastructure/http/controllers`).
  - **Flujo Obligatorio:** Rutas -> Controladores -> Casos de Uso (`src/application/use-cases`) -> Repositorios/Gateways (`src/infrastructure/database/repositories`).
- **Frontend (React + Tailwind + Vite):**
  - Patrón basado en Features (`client/src/features/`).
  - Separación de responsabilidades: Hooks personalizados para lógica de estado, Componentes puros para UI.

## 2. 🛡️ Seguridad y "La Fortaleza Fantasma"

- **Aislamiento de Inquilinos (Anti-IDOR):** - Toda consulta (`find`, `update`, `delete`) en repositorios DEBE estar filtrada por `{ businessId: user.businessId }`. Prohibido el cruce de datos entre negocios.
- **El Modo Fantasma (Rol GOD):**
  - Si el usuario tiene `role === 'GOD'`, el filtro `businessId` se desactiva (Bypass total).
  - El rol `GOD` es **invisible**. Cualquier acción ejecutada por este rol DEBE ser ignorada por el `AuditPersistenceUseCase` (Retorno temprano silencioso).
- **Protección Perimetral:**
  - Asume que todo input es malicioso. Los middlewares de `helmet`, `xss-clean` y `mongo-sanitize` ya operan globalmente. No introduzcas código que bypasee esta limpieza.

## 3. 💰 Reglas de Negocio Financiero (Blindaje)

- **Atomicidad (Race Conditions):** - Todo flujo crítico (Ventas, Traslados de Stock, Canje de Gamificación) DEBE ejecutarse dentro de una Transacción de MongoDB (`session.startTransaction()`).
- **Data Scrubbing (Privacidad):**
  - Si un usuario tiene `HIDE_FINANCIAL_DATA: true`, los campos `purchasePrice`, `averageCost`, `supplierId` y `profit` DEBEN setearse a `null` antes de responder en la API.
- **Precios Incorruptibles:**
  - NUNCA uses el `price` que envía el Frontend en el `req.body` para calcular totales. El Backend SIEMPRE debe consultar el precio real en la base de datos de Productos.
- **Jerarquía de Comisiones ("Ley del 30%"):**
  - Si `isCommissionFixed === true`, el `customCommissionRate` del usuario aplasta cualquier otra regla de puntos o gamificación.

## 4. 🎨 UI/UX Premium y Estándares de Código

- **Estándar Visual B2B2C:**
  - Aplica diseño premium en Tailwind CSS: Transiciones suaves (`transition-all duration-300`), estados interactivos claros, y jerarquía con sombras/glassmorphism.
- **UX Móvil a Prueba de Errores ("Bug del Dedo Gordo"):**
  - Todos los botones interactivos deben tener un área táctil mínima de `44px`.
  - **Safe Areas:** Usa paddings inferiores (ej. `pb-28`, `pb-32`) en contenedores scrolleables (`<main>`) para que el contenido no quede oculto bajo botones flotantes o barras de navegación móviles.
- **Naming Conventions:**
  - Lógica de dominio en inglés (ej. `RegisterSaleUseCase`, `AuditRepository`).
  - Variables claras y autodescriptivas. Evita abreviaciones cripticas (`prodId` -> `productId`).

## 5. ✅ Checklist Final antes de cada Commit

1. [ ] ¿La lógica de negocio está aislada en un Caso de Uso y NO en el Controlador?
2. [ ] ¿El endpoint verifica el `businessId` (Anti-IDOR)?
3. [ ] ¿Si es una venta o movimiento de stock, usa `session.startTransaction()`?
4. [ ] ¿Se ocultan los datos si el flag `HIDE_FINANCIAL_DATA` está activo?
5. [ ] ¿El UI respeta el _Safe Area_ en móviles y no solapa botones?
6. [ ] ¿El "Modo Fantasma" (Rol GOD) puede operar sin causar errores de tenant o dejar logs?
