# Módulo de Historial de Ganancias

## 📋 Descripción General

El módulo de Historial de Ganancias proporciona un sistema completo de tracking y auditoría de todas las ganancias generadas en el sistema, tanto de ventas normales como especiales. Registra automáticamente cada transacción con información detallada y mantiene un balance actualizado para cada usuario.

## 🏗️ Arquitectura

### Backend

#### **Modelo: ProfitHistory** (`server/models/ProfitHistory.js`)
Esquema principal que almacena cada entrada del historial.

**Campos principales:**
- `user`: Referencia al usuario (distribuidor o admin)
- `type`: Tipo de transacción (venta_normal, venta_especial, ajuste, bonus)
- `amount`: Monto de la ganancia
- `balanceAfter`: Balance acumulado después de esta transacción
- `sale/specialSale/product`: Referencias opcionales a la venta y producto
- `description`: Descripción legible de la transacción
- `date`: Fecha de la transacción
- `metadata`: Objeto flexible para información adicional

**Índices:**
- `{user: 1, date: -1}`: Consultas rápidas por usuario ordenadas por fecha
- `{type: 1, date: -1}`: Consultas por tipo de transacción

#### **Controlador: profitHistory.controller** (`server/controllers/profitHistory.controller.js`)

**Endpoints:**

1. **GET /api/profit-history/user/:userId**
   - Obtiene el historial paginado de un usuario
   - Parámetros: page, limit, type, startDate, endDate
   - Respuesta: Lista de entradas + resumen + paginación

2. **GET /api/profit-history/balance/:userId**
   - Obtiene el balance actual de un usuario
   - Respuesta: Balance total + desglose por tipo

3. **GET /api/profit-history/summary** (Admin)
   - Obtiene resumen agregado de ganancias
   - Parámetros: userId, startDate, endDate, groupBy (day/week/month)
   - Respuesta: Timeline con totales por período

4. **GET /api/profit-history/comparative** (Admin)
   - Compara mes actual vs mes anterior
   - Respuesta: Totales, conteos y % de cambio

5. **POST /api/profit-history** (Admin)
   - Crea entrada manual (ajustes, bonus)
   - Body: userId, type, amount, description, metadata

#### **Servicio: profitHistory.service** (`server/services/profitHistory.service.js`)

**Funciones principales:**

1. **recordProfitHistory(data)**
   - Función central para registrar cualquier entrada
   - Calcula balance automáticamente
   - Parámetros: userId, type, amount, description, referencias opcionales

2. **recordSaleProfit(saleId)**
   - Registra automáticamente ganancias de venta normal
   - Crea 2 entradas: distribuidor + admin
   - Llamada desde `sale.controller.js` al crear venta

3. **recordSpecialSaleProfit(specialSaleId)**
   - Registra ganancias de venta especial
   - Crea entrada para cada persona en distribution
   - Busca usuarios por nombre
   - Llamada desde `specialSale.controller.js`

4. **recalculateUserBalance(userId)**
   - Recalcula y actualiza todos los balances de un usuario
   - Útil para correcciones

### Frontend

#### **Servicio: profitHistoryService** (`client/src/api/services.ts`)

**Métodos:**
- `getUserHistory(userId, filters)`: Obtener historial con filtros
- `getUserBalance(userId)`: Balance actual
- `getProfitSummary(filters)`: Resumen agregado
- `getComparativeAnalysis(filters)`: Comparación mes a mes
- `createEntry(data)`: Crear entrada manual (admin)

#### **Componente: ProfitHistory** (`client/src/pages/ProfitHistory.tsx`)

**Funcionalidades:**
- 📊 Card de balance total con desglose por tipo
- 📈 Análisis comparativo mes actual vs anterior (admin)
- 🔍 Filtros: usuario, tipo, rango de fechas
- 📋 Tabla con historial paginado
- 💰 Visualización de balance running

**Permisos:**
- Distribuidores: Solo ven su propio historial
- Admin: Puede ver cualquier usuario + crear entradas manuales

**Ruta:** `/admin/profit-history`

## 🔄 Flujo de Datos

### Venta Normal
```
1. Distribuidor registra venta
2. Sale.create() → sale.controller.js
3. Después de guardar venta → recordSaleProfit(saleId)
4. Se crean 2 entradas en ProfitHistory:
   - Entrada para distribuidor (distributorProfit)
   - Entrada para admin (adminProfit)
5. Cada entrada calcula y guarda balanceAfter
```

### Venta Especial
```
1. Admin crea venta especial
2. SpecialSale.create() → specialSale.controller.js
3. Después de guardar → recordSpecialSaleProfit(specialSaleId)
4. Para cada persona en distribution[]:
   - Busca User por nombre
   - Si existe, crea entrada en ProfitHistory
   - Calcula balanceAfter acumulado
```

### Ajuste Manual (Admin)
```
1. Admin accede a endpoint POST /api/profit-history
2. Especifica: userId, type=ajuste, amount, description
3. Se crea entrada con balance calculado
4. Puede ser monto positivo o negativo
```

## 📊 Tipos de Transacciones

| Tipo | Descripción | Generado por |
|------|-------------|--------------|
| `venta_normal` | Ganancia de venta regular | Sistema automático |
| `venta_especial` | Ganancia de venta especial/evento | Sistema automático |
| `ajuste` | Corrección manual de balance | Admin manual |
| `bonus` | Bonus/incentivo adicional | Admin manual |

## 🚀 Migración de Datos Históricos

**Script:** `server/migrateHistoricalData.js`

**Proceso:**
1. Limpia historial existente
2. Lee todas las ventas normales ordenadas cronológicamente
3. Crea entradas para distribuidor + admin de cada venta
4. Lee todas las ventas especiales
5. Busca usuarios por nombre de distribution
6. Crea entradas para cada distribución encontrada
7. Calcula balances incrementales correctamente

**Ejecución:**
```bash
cd server
node migrateHistoricalData.js
```

**Resultado esperado:**
- Todas las ventas históricas convertidas a entradas
- Balances calculados cronológicamente
- Resumen por usuario mostrado

## 🧪 Testing

**Script de prueba:** `server/testProfitHistory.js`

**Verificaciones:**
- Balance total por usuario
- Balance por tipo de transacción
- Últimas 5 transacciones de cada usuario
- Estadísticas generales del sistema
- Transacciones por mes
- Integridad de balances (suma vs balanceAfter)

**Ejecución:**
```bash
cd server
node testProfitHistory.js
```

## 📈 Resultado de Migración

### Resumen Actual
```
Total de entradas creadas: 89

BALANCES POR USUARIO:
- Administrador: $579,740 (41 transacciones normales)
- Diego Gonzalez: $149,710 (13 normales + 7 especiales)
- Pedro Fabian: $72,800 (10 normales)
- IZAN: $50,000 (7 especiales)
- Maria Jose: $42,750 (7 normales)
- Santiago: $32,000 (4 normales)

ESTADÍSTICAS GENERALES:
- Ventas Normales: $827,000 (75 transacciones)
- Ventas Especiales: $100,000 (14 transacciones)
- Total General: $927,000
```

## 🔒 Seguridad y Permisos

### Endpoints Protegidos
- Todos los endpoints requieren autenticación (`protect` middleware)
- Endpoints de resumen/comparativo/creación requieren rol admin
- Distribuidores solo acceden a su propio historial

### Validaciones
- Usuario debe existir
- Type debe ser válido (enum)
- Amount debe ser numérico
- Balance calculado automáticamente (no editable por usuario)

## 🛠️ Mantenimiento

### Recalcular Balances
Si detectas discrepancias en balances:

```javascript
import { recalculateUserBalance } from './services/profitHistory.service.js';

// Para un usuario específico
await recalculateUserBalance(userId);
```

### Limpiar y Re-migrar
Si necesitas resetear el historial:

```bash
cd server
node migrateHistoricalData.js
```

Esto limpia el historial existente y lo regenera desde las ventas.

## 📝 Notas Importantes

1. **No-Blocking**: La grabación del historial NO bloquea la creación de ventas. Si falla, se registra el error pero la venta se completa.

2. **Sincronía de Balances**: Los balances se calculan al momento de inserción usando agregación de MongoDB, garantizando precisión.

3. **Usuarios No Encontrados**: En ventas especiales, si un nombre en `distribution` no coincide con ningún usuario, se registra warning pero continúa el proceso.

4. **Metadata Flexible**: El campo `metadata` permite guardar información adicional sin modificar el schema (saleId, eventName, bonus%, etc.)

5. **Timestamps Automáticos**: Mongoose gestiona `createdAt` y `updatedAt` automáticamente.

## 🎯 Casos de Uso

### Distribuidor consulta su balance
1. Accede a `/admin/profit-history` (si es distribuidor, ve solo su data)
2. Ve card con balance total desglosado
3. Filtra por tipo o fechas
4. Ve tabla con todas sus transacciones

### Admin audita ganancias
1. Accede a `/admin/profit-history`
2. Selecciona distribuidor del dropdown
3. Ve análisis comparativo mes a mes
4. Aplica filtros de fecha/tipo
5. Exporta o analiza datos

### Admin crea ajuste manual
1. Usa endpoint POST /api/profit-history
2. Especifica userId, amount (puede ser negativo), description
3. Sistema registra y actualiza balance automáticamente

## 🔮 Futuras Mejoras

- [ ] Exportación a Excel/CSV
- [ ] Gráficas de evolución temporal
- [ ] Alertas de metas alcanzadas
- [ ] Proyecciones de ganancias
- [ ] Reportes automatizados por email
- [ ] Dashboard de KPIs en tiempo real

---

**Creado por:** Sistema de Gestión ESSENCE  
**Última actualización:** 13 de enero de 2025  
**Versión:** 1.0.0
