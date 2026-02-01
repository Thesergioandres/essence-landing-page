# PROJECT_ARCHITECTURE_REPORT.md

## 🏗️ High-Level Architecture

### Pattern Identification

El proyecto sigue una **arquitectura modular** con una separación clara entre el backend y el frontend. El backend maneja la lógica de negocio y las API, mientras que el frontend se encarga de la interfaz de usuario.

### Tech Stack

- **Backend**:
  - Lenguaje: JavaScript (Node.js)
  - Framework: Express.js
  - Base de datos: MongoDB (confirmado por el uso de Mongoose en `server/models/Sale.js`)
  - Librerías clave:
    - `mongoose`
    - `exceljs`
    - `date-fns`
  - Dependencias de desarrollo:
    - `concurrently v8.2.2`

- **Frontend**:
  - Lenguaje: JavaScript (React.js)
  - Framework: React.js
  - Estilos: TailwindCSS
  - Gestión de estado: No encontrado en los archivos disponibles.

### Estructura de Carpetas

- `server/`: Contiene la lógica del backend, incluyendo controladores, servicios y modelos.
- `client/`: Contiene la lógica del frontend, incluyendo componentes React y recursos.
- `docs/`: Archivos de documentación.
- `scripts/`: Scripts de utilidad para despliegue, backups y verificaciones.
- `backups/`: Archivos de respaldo organizados por fecha.
- `deploy/`: Archivos relacionados con el despliegue.

## 🧠 Logic Distribution (CRITICAL)

### Backend Logic

- **Lógica de negocio**:
  - Archivo: `server/controllers/advancedAnalytics.controller.js`.
  - Ejemplo: La función `getSalesTimeline` (línea 117) realiza cálculos de ingresos (`revenue`) y beneficios (`profit`) utilizando agregaciones de MongoDB.
  - Los cálculos de beneficios incluyen deducciones como `shippingCost`, `distributorProfit`, `discount` y `totalAdditionalCosts` (líneas 202-216).

### Frontend Logic

- **Componentes que realizan cálculos**:
  - No se encontraron componentes en `client/src` debido a la falta de acceso a los archivos específicos. Se requiere acceso a los archivos `.jsx` o `.js` en el directorio `client/src` para confirmar.

### Consistency Check

- No se encontraron evidencias de cálculos duplicados entre el frontend y el backend debido a la falta de acceso a los archivos del frontend.

## 💾 Database & Data Model

### Schema Overview

- **Modelo `Sale`** (archivo: `server/models/Sale.js`):
  - Campos principales:
    - `business`: Referencia a `Business`.
    - `branch`: Referencia a `Branch`.
    - `customer`: Referencia a `Customer`.
    - `saleId`: String, requerido.
    - `saleGroupId`: String, indexado.
    - `product`: Referencia a `Product`, requerido.
    - `productName`: String, opcional.
    - `revenue`: Calculado como `$multiply: ["$salePrice", "$quantity"]`.
    - `profit`: Calculado como `$subtract` de ingresos menos costos adicionales.

### Data Flow

- Los datos fluyen desde la base de datos a través de agregaciones de MongoDB en los controladores, como se observa en `server/controllers/advancedAnalytics.controller.js`.

## 🔌 API & Communication

### Endpoints

- **Rutas principales** (archivo: `server/controllers/advancedAnalytics.controller.js`):
  - `/api/advanced-analytics/sales-timeline` (línea 115): Obtiene datos de la línea de tiempo de ventas.
  - `/api/advanced-analytics/sales-by-category` (línea 407): Obtiene ventas por categoría.
  - `/api/analytics/monthly-profit` (línea 1379): Obtiene el beneficio mensual.
  - `/api/analytics/financial-summary` (línea 2091): Resumen financiero.

### State Management

- No se encontró evidencia de gestión de estado en el frontend debido a la falta de acceso a los archivos del cliente.

## 🚦 Health Check & Risks

### Coupling

- Los módulos parecen estar moderadamente acoplados. Por ejemplo, el controlador `advancedAnalytics.controller.js` importa múltiples modelos (`Sale`, `SpecialSale`, `Product`, etc.), lo que podría dificultar la separación de responsabilidades.

### Code Quality

- Se encontraron cálculos complejos directamente en los controladores, como en `getSalesTimeline` (línea 117 de `advancedAnalytics.controller.js`). Esto podría beneficiarse de una refactorización hacia servicios dedicados.

### Migration Feasibility

- **Veredicto preliminar**: La migración a una arquitectura hexagonal es posible, pero requerirá una refactorización significativa para desacoplar la lógica de negocio de los controladores y moverla a servicios dedicados.

---

**Nota**: Este informe se basa en la lectura de los archivos disponibles. Se requiere acceso a los archivos del frontend para completar el análisis.
