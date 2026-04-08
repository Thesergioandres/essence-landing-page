# 📋 REQUERIMIENTOS DEL SISTEMA (SRS)

> **Propósito:** Especificación formal de Requerimientos de Software (SRS) detallando las obligaciones funcionales y no funcionales de Essence ERP, diseñado para validación por parte del equipo de Quality Assurance (QA).

---

## ⚙️ 1. Requerimientos Funcionales (RF)

| ID | Módulo | Descripción | Prioridad |
|:---|:---|:---|:---:|
| **RF-01** | Autenticación | El sistema debe permitir el inicio de sesión basado en JWT con expiración definida, validando el `status` del usuario en cada petición. | Alta |
| **RF-02** | Autorización | El sistema debe cancelar el acceso a los *Distribuidores* de manera cascada si la suscripción de su *Owner* (Admin) caduca o es suspendida. | Crítica |
| **RF-03** | Multi-Tenant | El sistema debe instanciar contextos de sesión basados en un `businessId`, aislando absolutamente la data entre diferentes empresas. | Crítica |
| **RF-04** | Feature Flags | El sistema debe permitir deshabilitar módulos completos (ej. "*Gamificación*") a nivel de Negocio, bloqueando las peticiones a nivel Router/Middleware. | Media |
| **RF-05** | Inventario | La actualización de inventario durante una venta debe soportar inserciones atómicas (`$inc` en MongoDB) para evitar *Race Conditions* en ventas simultáneas. | Crítica |
| **RF-06** | Inventario | El sistema debe calcular el Costo Promedio Ponderado de manera automática única y exclusivamente en las entradas por compras, ignorando salidas o transferencias. | Alta |
| **RF-07** | Ventas | Las reglas de cálculo de venta para el Administrador deben seguir la ecuación: `(Venta Total) - (Costo) - (Ganancia Distribuidor)`. | Alta |
| **RF-08** | Ventas | Las ventas con pago "Crédito" deben excluirse de la sumatoria de Ganancias Netas dentro de cualquier Query Analítico. | Crítica |

---

## 🛡️ 2. Requerimientos No Funcionales (RNF)

| ID | Categoría | Descripción |
|:---|:---|:---|
| **RNF-01** | Rendimiento | Las consultas al Dashboard Analítico no deben tardar más de 800ms en procesar volumetria de hasta 1 millón de ventas (requiere índices MongoDB en `saleDate` y `paymentStatus`). |
| **RNF-02** | Seguridad | El backend no debe confiar en el cálculo financiero enviado por el cliente (Frontend). Los precios de cliente o distribuidor deben cruzarse obligatoriamente con la base de datos de Productos durante la transacción. |
| **RNF-03** | Privacidad | Las llamadas al API realizadas por rol `distribuidor` para solicitar catálogo de productos, deben enmascarar en el DTO (Data Transfer Object) los campos: `purchasePrice`, `averageCost` y variables financieras de la administración. |
| **RNF-04** | Disponibilidad| Los endpoints críticos de punto de venta (Sales/POS) deben operar bajo un esquema de alta disponibilidad, orquestando las instancias detrás de PM2 o un orquestador contenedorizado. |
| **RNF-05** | Mantenibilidad| Todo error procesado en los controladores debe atraparse y unificarse bajo un solo *Error Handler Middleware* para proveer a los clientes un Payload estándar (código, mensaje, detalles técnicos). |
