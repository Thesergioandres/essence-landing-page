import { body, param, query, validationResult } from "express-validator";

/**
 * Middleware para manejar errores de validación
 */
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: "Datos de entrada inválidos",
      errors: errors.array().map((e) => ({
        field: e.path,
        message: e.msg,
        value: e.value,
      })),
    });
  }
  next();
};

/**
 * Sanitizadores comunes
 */
const sanitizers = {
  trimString: (field) => body(field).trim().escape(),
  email: (field) =>
    body(field).isEmail().normalizeEmail().withMessage("Email inválido"),
  objectId: (field) =>
    param(field).isMongoId().withMessage(`${field} debe ser un ID válido`),
  optionalObjectId: (field) =>
    body(field)
      .optional()
      .isMongoId()
      .withMessage(`${field} debe ser un ID válido`),
  positiveNumber: (field) =>
    body(field)
      .isFloat({ min: 0 })
      .withMessage(`${field} debe ser un número positivo`),
  positiveInt: (field) =>
    body(field)
      .isInt({ min: 0 })
      .withMessage(`${field} debe ser un entero positivo`),
  boolean: (field) =>
    body(field).optional().isBoolean().withMessage(`${field} debe ser boolean`),
  date: (field) =>
    body(field)
      .optional()
      .isISO8601()
      .withMessage(`${field} debe ser fecha válida`),
  pagination: () => [
    query("page").optional().isInt({ min: 1 }).toInt(),
    query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
};

/**
 * Validaciones para Auth
 */
export const authValidation = {
  register: [
    body("name")
      .notEmpty()
      .withMessage("El nombre es obligatorio")
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage("El nombre debe tener entre 2 y 100 caracteres"),
    body("email")
      .notEmpty()
      .withMessage("El email es obligatorio")
      .isEmail()
      .withMessage("Email inválido")
      .normalizeEmail(),
    body("password")
      .notEmpty()
      .withMessage("La contraseña es obligatoria")
      .isLength({ min: 6 })
      .withMessage("La contraseña debe tener al menos 6 caracteres"),
    handleValidationErrors,
  ],
  login: [
    body("email")
      .notEmpty()
      .withMessage("El email es obligatorio")
      .isEmail()
      .withMessage("Email inválido")
      .normalizeEmail(),
    body("password").notEmpty().withMessage("La contraseña es obligatoria"),
    handleValidationErrors,
  ],
};

/**
 * Validaciones para Products
 */
export const productValidation = {
  create: [
    body("name")
      .notEmpty()
      .withMessage("El nombre es obligatorio")
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage("Nombre inválido"),
    body("purchasePrice")
      .isFloat({ min: 0 })
      .withMessage("Precio de compra inválido"),
    body("employeePrice")
      .isFloat({ min: 0 })
      .withMessage("Precio de employee inválido"),
    body("category").optional().isMongoId().withMessage("Categoría inválida"),
    body("totalStock")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Stock inválido"),
    body("featured").optional().isBoolean(),
    handleValidationErrors,
  ],
  update: [
    param("id").isMongoId().withMessage("ID de producto inválido"),
    body("name").optional().trim().isLength({ min: 1, max: 200 }),
    body("purchasePrice").optional().isFloat({ min: 0 }),
    body("employeePrice").optional().isFloat({ min: 0 }),
    handleValidationErrors,
  ],
  getById: [
    param("id").isMongoId().withMessage("ID de producto inválido"),
    handleValidationErrors,
  ],
};

/**
 * Validaciones para Sales
 */
export const saleValidation = {
  create: [
    body("product").isMongoId().withMessage("Producto inválido"),
    body("quantity")
      .isInt({ min: 1 })
      .withMessage("Cantidad debe ser al menos 1"),
    body("salePrice")
      .isFloat({ min: 0 })
      .withMessage("Precio de venta inválido"),
    body("customer").optional().isMongoId().withMessage("Cliente inválido"),
    body("paymentType")
      .optional()
      .isIn(["cash", "card", "transfer", "fiado"])
      .withMessage("Tipo de pago inválido"),
    handleValidationErrors,
  ],
  getById: [
    param("id").isMongoId().withMessage("ID de venta inválido"),
    handleValidationErrors,
  ],
};

/**
 * Validaciones para Credits
 */
export const creditValidation = {
  create: [
    body("customerId").isMongoId().withMessage("Cliente inválido"),
    body("amount")
      .isFloat({ min: 0.01 })
      .withMessage("Monto debe ser mayor a 0"),
    body("dueDate")
      .optional()
      .isISO8601()
      .withMessage("Fecha de vencimiento inválida"),
    body("description")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Descripción muy larga"),
    handleValidationErrors,
  ],
  registerPayment: [
    param("id").isMongoId().withMessage("ID de crédito inválido"),
    body("amount")
      .isFloat({ min: 0.01 })
      .withMessage("Monto de pago debe ser mayor a 0"),
    body("method")
      .optional()
      .isIn(["cash", "card", "transfer"])
      .withMessage("Método de pago inválido"),
    handleValidationErrors,
  ],
  getById: [
    param("id").isMongoId().withMessage("ID de crédito inválido"),
    handleValidationErrors,
  ],
  getByCustomer: [
    param("customerId").isMongoId().withMessage("ID de cliente inválido"),
    handleValidationErrors,
  ],
};

/**
 * Validaciones para Customers
 */
export const customerValidation = {
  create: [
    body("name")
      .notEmpty()
      .withMessage("El nombre es obligatorio")
      .trim()
      .isLength({ min: 1, max: 200 }),
    body("email").optional().isEmail().normalizeEmail(),
    body("phone").optional().trim().isLength({ max: 20 }),
    handleValidationErrors,
  ],
  update: [
    param("id").isMongoId().withMessage("ID de cliente inválido"),
    body("name").optional().trim().isLength({ min: 1, max: 200 }),
    body("email").optional().isEmail().normalizeEmail(),
    handleValidationErrors,
  ],
  getById: [
    param("id").isMongoId().withMessage("ID de cliente inválido"),
    handleValidationErrors,
  ],
};

/**
 * Validaciones para Business
 */
export const businessValidation = {
  create: [
    body("name")
      .notEmpty()
      .withMessage("El nombre es obligatorio")
      .trim()
      .isLength({ min: 2, max: 100 }),
    body("contactEmail").optional().isEmail().normalizeEmail(),
    body("contactPhone").optional().trim().isLength({ max: 20 }),
    handleValidationErrors,
  ],
  update: [
    param("businessId").isMongoId().withMessage("ID de negocio inválido"),
    body("name").optional().trim().isLength({ min: 2, max: 100 }),
    body("contactEmail").optional().isEmail().normalizeEmail(),
    handleValidationErrors,
  ],
};

/**
 * Validaciones para GOD panel
 */
export const godValidation = {
  userAction: [
    param("id").isMongoId().withMessage("ID de usuario inválido"),
    handleValidationErrors,
  ],
  duration: [
    param("id").isMongoId().withMessage("ID de usuario inválido"),
    body("days").optional().isInt({ min: 0 }).withMessage("Días inválidos"),
    body("months").optional().isInt({ min: 0 }).withMessage("Meses inválidos"),
    body("years").optional().isInt({ min: 0 }).withMessage("Años inválidos"),
    handleValidationErrors,
  ],
};

/**
 * Validaciones comunes para IDs en params
 */
export const commonValidation = {
  mongoId: (paramName = "id") => [
    param(paramName).isMongoId().withMessage(`${paramName} inválido`),
    handleValidationErrors,
  ],
  pagination: [
    query("page").optional().isInt({ min: 1 }).toInt(),
    query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
    handleValidationErrors,
  ],
};

export { body, param, query, validationResult };
