# 🔁 DIAGRAMAS DE SECUENCIA (LIFECYCLE)

> **Propósito:** Esquematizar en formato de secuencia los flujos de arquitectura de red y la interacción entre Backend, Base de Datos y Servicios de Dominio. 

---

## 1. Patrón Hexagonal: Registro de Venta y Deducción Atómica

El siguiente diagrama detalla la ruta de los datos atravesando los *Drivers Adapters* (Controller) hacia los *Use Cases* (Aplicación) y finalmente al repositorio de datos.

```mermaid
sequenceDiagram
    autonumber
    actor ClienteFrontend as POS/React
    participant Express middleware as auth.middleware
    participant Controller as SaleController
    participant UseCase as RegisterSaleUseCase
    participant Finance as FinanceService
    participant DBProduct as ProductRepository (Mongoose)
    participant DBSale as SaleRepository (Mongoose)

    ClienteFrontend->>Express middleware: POST /api/sales { items, payment }
    Express middleware->>Express middleware: Valida JWT y BusinessContext
    Express middleware->>Controller: req (auth ok)
    
    Controller->>UseCase: execute(saleDTO, userId, businessId)
    
    UseCase->>DBProduct: lock_and_check_stock(items)
    DBProduct-->>UseCase: stock disponible = true
    
    UseCase->>Finance: calculateAdminProfit(price, costBasis)
    Finance-->>UseCase: 22,000 USD
    
    UseCase->>DBProduct: dec($inc: { warehouseStock: -qty })
    DBProduct-->>UseCase: Ok (Atómico)
    
    UseCase->>DBSale: saveTransaction(saleData)
    DBSale-->>UseCase: Sale ID: Object(XXX)
    
    UseCase-->>Controller: Ticket Result
    Controller-->>ClienteFrontend: HTTP 201 Created (Venta Exitosa)
```

---

## 2. Herencia de Acceso (Validación Owner para Employee)

Este diagrama demuestra las reglas de seguridad invisibles operando a nivel de *Middleware*.

```mermaid
sequenceDiagram
    autonumber
    actor Dist as Empleado (App)
    participant Auth as ProtectMiddleware
    participant DBUser as UserRepository
    
    Dist->>Auth: GET /api/products
    Auth->>Auth: Verifica Local JWT
    Auth->>DBUser: findOne({ id: empleado.id })
    DBUser-->>Auth: user ok -> role='empleado'
    
    Note over Auth, DBUser: Regla Inflexible Essence
    Auth->>DBUser: findOwner(businessId)
    DBUser-->>Auth: OwnerData { status: 'expired' }
    
    Auth-->>Dist: HTTP 403 Forbidden ("Admin inactivo")
```
