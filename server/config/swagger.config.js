import swaggerJsdoc from "swagger-jsdoc";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Essence API",
      version: "1.0.0",
      description: `
## API Backend para Essence

Sistema de gestión de negocios con soporte para:
- **Autenticación**: JWT con roles (user, admin, empleado, super_admin, god)
- **Negocios**: Gestión multi-tenant con memberships
- **Productos**: Catálogo con precios diferenciados
- **Ventas**: Registro de transacciones con comisiones
- **Créditos (Fiado)**: Sistema de créditos a clientes
- **Inventario**: Control de stock por sucursal
- **Gamificación**: Sistema de puntos y niveles
- **Reportes**: Analytics y dashboards
- **Notificaciones**: Sistema de alertas

### Autenticación
Usar el header \`Authorization: Bearer <token>\` para rutas protegidas.
Para rutas de negocio, incluir también \`x-business-id\`.
      `,
      contact: {
        name: "Soporte",
        email: "soporte@essence.com",
      },
    },
    servers: [
      {
        url: "/api",
        description: "API Server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Token JWT obtenido en /auth/login",
        },
      },
      schemas: {
        User: {
          type: "object",
          properties: {
            _id: { type: "string", example: "507f1f77bcf86cd799439011" },
            name: { type: "string", example: "Juan Pérez" },
            email: {
              type: "string",
              format: "email",
              example: "juan@email.com",
            },
            role: {
              type: "string",
              enum: ["user", "admin", "empleado", "super_admin", "god"],
              example: "admin",
            },
            status: {
              type: "string",
              enum: ["pending", "active", "expired", "suspended", "paused"],
              example: "active",
            },
            subscriptionExpiresAt: { type: "string", format: "date-time" },
            phone: { type: "string" },
            address: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        Business: {
          type: "object",
          properties: {
            _id: { type: "string" },
            name: { type: "string", example: "Mi Negocio" },
            description: { type: "string" },
            logoUrl: { type: "string" },
            contactEmail: { type: "string", format: "email" },
            contactPhone: { type: "string" },
            contactWhatsapp: { type: "string" },
            contactLocation: { type: "string" },
            status: { type: "string", enum: ["active", "archived"] },
            config: {
              type: "object",
              properties: {
                features: {
                  type: "object",
                  properties: {
                    products: { type: "boolean" },
                    inventory: { type: "boolean" },
                    sales: { type: "boolean" },
                    promotions: { type: "boolean" },
                    clients: { type: "boolean" },
                    gamification: { type: "boolean" },
                    expenses: { type: "boolean" },
                    notifications: { type: "boolean" },
                  },
                },
              },
            },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Product: {
          type: "object",
          properties: {
            _id: { type: "string" },
            name: { type: "string", example: "Producto A" },
            description: { type: "string" },
            purchasePrice: { type: "number", example: 100 },
            employeePrice: { type: "number", example: 150 },
            clientPrice: { type: "number", example: 200 },
            suggestedPrice: { type: "number", example: 200 },
            category: { type: "string" },
            totalStock: { type: "number" },
            warehouseStock: { type: "number" },
            lowStockAlert: { type: "number" },
            featured: { type: "boolean" },
            active: { type: "boolean" },
            image: {
              type: "object",
              properties: {
                url: { type: "string" },
                publicId: { type: "string" },
              },
            },
          },
        },
        Sale: {
          type: "object",
          properties: {
            _id: { type: "string" },
            employee: { type: "string", description: "ID del empleado" },
            customer: { type: "string", description: "ID del cliente" },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  product: { type: "string" },
                  productName: { type: "string" },
                  quantity: { type: "number" },
                  price: { type: "number" },
                  subtotal: { type: "number" },
                },
              },
            },
            total: { type: "number" },
            profit: { type: "number" },
            paymentType: {
              type: "string",
              enum: ["cash", "card", "transfer", "fiado"],
            },
            status: {
              type: "string",
              enum: ["completed", "pending", "cancelled"],
            },
            saleDate: { type: "string", format: "date-time" },
          },
        },
        Credit: {
          type: "object",
          properties: {
            _id: { type: "string" },
            customer: { type: "string" },
            sale: { type: "string" },
            amount: { type: "number", example: 500 },
            paidAmount: { type: "number", example: 200 },
            status: { type: "string", enum: ["pending", "paid", "overdue"] },
            dueDate: { type: "string", format: "date-time" },
            payments: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  amount: { type: "number" },
                  paidAt: { type: "string", format: "date-time" },
                  method: { type: "string" },
                },
              },
            },
          },
        },
        Error: {
          type: "object",
          properties: {
            message: { type: "string" },
            error: { type: "string" },
          },
        },
        SuccessResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string" },
          },
        },
      },
      parameters: {
        BusinessId: {
          in: "header",
          name: "x-business-id",
          required: true,
          schema: { type: "string" },
          description: "ID del negocio actual",
        },
      },
      responses: {
        Unauthorized: {
          description: "No autorizado - Token inválido o expirado",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
            },
          },
        },
        Forbidden: {
          description: "Prohibido - Sin permisos suficientes",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
            },
          },
        },
        NotFound: {
          description: "Recurso no encontrado",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
            },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: "Auth", description: "Autenticación y usuarios" },
      { name: "Business", description: "Gestión de negocios" },
      { name: "Products", description: "Catálogo de productos" },
      { name: "Sales", description: "Registro de ventas" },
      { name: "Credits", description: "Sistema de créditos (fiado)" },
      { name: "Customers", description: "Gestión de clientes" },
      { name: "Stock", description: "Control de inventario" },
      { name: "Analytics", description: "Reportes y estadísticas" },
      { name: "Notifications", description: "Sistema de notificaciones" },
      { name: "Gamification", description: "Sistema de puntos y niveles" },
      { name: "GOD", description: "Panel de control global (solo god)" },
    ],
  },
  apis: ["./routes/*.js", "./controllers/*.js"],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
