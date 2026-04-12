# 📡 ESPECIFICACIÓN DE LA API REST

> **Propósito:** Documento canónico para integración Frontend-Backend y consumo de servicios HTTP del ERP Essence. Útil para configuración en Axios/Postman.

---

## 1. Reglas Generales de Conexión

*   **URL Base:** `/api/v1`
*   **Acepta / Retorna:** `application/json`
*   **Manejo de Respuestas (Patrón Canónico):** Todo éxito vendrá envuelto en un wrapper. Todo fallo regresará con el flag de `success: false`.

```json
/* ÉXITO HTTP 2xx */
{
    "success": true,
    "data": { ... },
    "message": "" // opcional
}

/* ERROR HTTP 4xx / 5xx */
{
    "success": false,
    "message": "Mensaje legible del error",
    "details": "Stack trace (exclusivo para Entorno DEV)"
}
```

---

## 2. Inyección de Contextos (Headers Mandatorios)

Todo Endpoint que no sea Login, requiere inyectarle al servidor:
1. **Authorization Bearer [JWT]** : Token de seguridad web inyectado por el servicio de `login`.
2. **x-business-id [STRING_ID]** : Opcional pero crítico. Es el ObjectID de la empresa que está visualizando la persona (El frontend inyecta de su `localStorage` general).

---

## 3. Endpoints Principales (Ejemplos Críticos)

### 🔑 Autenticación (Auth)
#### `POST /auth/login`
- **Uso:** Autenticar un usuario y obtener token y roles de respuesta.
- **Body:** `{ email: "x", password: "y" }`
- **Response `200`:** `token`, `user: { role, status, _id }`, `memberships: [...]` (Array de accesos a n negocios).

### 🛒 Registro de Ventas (Sales)
#### `POST /sales/register`
- **Middlewares que pasan:** `[protect, businessContext, checkFeatures('sales')]`
- **Rol requerdio:** `Admin` o `Empleado`.
- **Body:**
```json
{
  "items": [
    { "productId": "5fX...", "quantity": 10, "unitPrice": 50000 }
  ],
  "paymentMethodId": "cash",
  "shippingCost": 5000,
  "client": "5fX..." 
}
```
- **Response `201`:** `{ success: true, message: "Venta Registrada y stock deducido" }`

### 📦 Inventario Global
#### `GET /products`
- **Middlewares:** `[protect, businessContext]`
- **QueryParams permitidos:** `?page=1&limit=20&search=celular`
- **NOTA TÉCNICA (CEGUERA EMPLEADO):** Si este Endpoint lo invoca la ruta conteniendo el JWT de un "Empleado", el `SaleController` activará un `DTOFilter` el cual devolverá el objeto mutilado:
*Censurado = `{ "averageCost": null, "purchasePrice": null, "totalInventoryValue": null }`*.
