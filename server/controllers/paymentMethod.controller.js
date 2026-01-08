import PaymentMethod from "../models/PaymentMethod.js";

/**
 * @desc    Obtener todos los métodos de pago del negocio
 * @route   GET /api/payment-methods
 * @access  Private
 */
export const getPaymentMethods = async (req, res) => {
  try {
    const { includeInactive } = req.query;

    const query = { business: req.businessId };
    if (!includeInactive) {
      query.isActive = true;
    }

    const methods = await PaymentMethod.find(query)
      .sort({ displayOrder: 1, createdAt: 1 })
      .lean();

    // Si no hay métodos, crear los por defecto
    if (methods.length === 0) {
      const defaultMethods = await PaymentMethod.createDefaultMethods(
        req.businessId,
        req.user?.id
      );
      return res.json(defaultMethods);
    }

    res.json(methods);
  } catch (error) {
    console.error("Error al obtener métodos de pago:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Obtener un método de pago por ID
 * @route   GET /api/payment-methods/:id
 * @access  Private
 */
export const getPaymentMethodById = async (req, res) => {
  try {
    const method = await PaymentMethod.findOne({
      _id: req.params.id,
      business: req.businessId,
    });

    if (!method) {
      return res.status(404).json({ message: "Método de pago no encontrado" });
    }

    res.json(method);
  } catch (error) {
    console.error("Error al obtener método de pago:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Crear un nuevo método de pago
 * @route   POST /api/payment-methods
 * @access  Private/Admin
 */
export const createPaymentMethod = async (req, res) => {
  try {
    const {
      name,
      description,
      isCredit,
      requiresConfirmation,
      requiresProof,
      icon,
      color,
      displayOrder,
    } = req.body;

    if (!name) {
      return res.status(400).json({ message: "El nombre es obligatorio" });
    }

    // Verificar que no exista uno con el mismo nombre
    const existingByName = await PaymentMethod.findOne({
      business: req.businessId,
      name: { $regex: new RegExp(`^${name}$`, "i") },
    });

    if (existingByName) {
      return res.status(400).json({
        message: "Ya existe un método de pago con ese nombre",
      });
    }

    // Obtener el orden máximo para asignar el siguiente
    const maxOrder = await PaymentMethod.findOne({ business: req.businessId })
      .sort({ displayOrder: -1 })
      .select("displayOrder")
      .lean();

    const newMethod = await PaymentMethod.create({
      business: req.businessId,
      name,
      description,
      isCredit: isCredit || false,
      requiresConfirmation: requiresConfirmation || false,
      requiresProof: requiresProof || false,
      icon: icon || "wallet",
      color: color || "#8B5CF6",
      displayOrder: displayOrder || (maxOrder?.displayOrder || 0) + 1,
      isSystem: false,
      createdBy: req.user?.id,
    });

    res.status(201).json({
      message: "Método de pago creado exitosamente",
      paymentMethod: newMethod,
    });
  } catch (error) {
    console.error("Error al crear método de pago:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Actualizar un método de pago
 * @route   PUT /api/payment-methods/:id
 * @access  Private/Admin
 */
export const updatePaymentMethod = async (req, res) => {
  try {
    const method = await PaymentMethod.findOne({
      _id: req.params.id,
      business: req.businessId,
    });

    if (!method) {
      return res.status(404).json({ message: "Método de pago no encontrado" });
    }

    // No permitir editar métodos del sistema (cash y credit)
    if (
      method.isSystem &&
      (method.code === "cash" || method.code === "credit")
    ) {
      // Solo permitir cambiar algunos campos de métodos del sistema
      const allowedFields = ["isActive", "displayOrder"];
      const updates = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          message:
            "No se pueden modificar los métodos de pago del sistema (Efectivo y Crédito)",
        });
      }

      Object.assign(method, updates);
    } else {
      // Para métodos personalizados, permitir editar todo excepto code e isSystem
      const {
        name,
        description,
        isCredit,
        requiresConfirmation,
        requiresProof,
        icon,
        color,
        isActive,
        displayOrder,
      } = req.body;

      if (name !== undefined) {
        // Verificar nombre único
        const existingByName = await PaymentMethod.findOne({
          business: req.businessId,
          name: { $regex: new RegExp(`^${name}$`, "i") },
          _id: { $ne: method._id },
        });

        if (existingByName) {
          return res.status(400).json({
            message: "Ya existe un método de pago con ese nombre",
          });
        }
        method.name = name;
      }

      if (description !== undefined) method.description = description;
      if (isCredit !== undefined) method.isCredit = isCredit;
      if (requiresConfirmation !== undefined)
        method.requiresConfirmation = requiresConfirmation;
      if (requiresProof !== undefined) method.requiresProof = requiresProof;
      if (icon !== undefined) method.icon = icon;
      if (color !== undefined) method.color = color;
      if (isActive !== undefined) method.isActive = isActive;
      if (displayOrder !== undefined) method.displayOrder = displayOrder;
    }

    await method.save();

    res.json({
      message: "Método de pago actualizado exitosamente",
      paymentMethod: method,
    });
  } catch (error) {
    console.error("Error al actualizar método de pago:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Eliminar un método de pago
 * @route   DELETE /api/payment-methods/:id
 * @access  Private/Admin
 */
export const deletePaymentMethod = async (req, res) => {
  try {
    const method = await PaymentMethod.findOne({
      _id: req.params.id,
      business: req.businessId,
    });

    if (!method) {
      return res.status(404).json({ message: "Método de pago no encontrado" });
    }

    // No permitir eliminar métodos del sistema
    if (method.isSystem) {
      return res.status(400).json({
        message:
          "No se pueden eliminar los métodos de pago del sistema. Puedes desactivarlo en su lugar.",
      });
    }

    // Verificar si hay ventas con este método de pago
    const Sale = (await import("../models/Sale.js")).default;
    const salesCount = await Sale.countDocuments({
      business: req.businessId,
      paymentMethod: method._id,
    });

    if (salesCount > 0) {
      return res.status(400).json({
        message: `No se puede eliminar porque hay ${salesCount} venta(s) registrada(s) con este método de pago. Puedes desactivarlo en su lugar.`,
      });
    }

    await PaymentMethod.findByIdAndDelete(method._id);

    res.json({ message: "Método de pago eliminado exitosamente" });
  } catch (error) {
    console.error("Error al eliminar método de pago:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Reordenar métodos de pago
 * @route   PUT /api/payment-methods/reorder
 * @access  Private/Admin
 */
export const reorderPaymentMethods = async (req, res) => {
  try {
    const { orderedIds } = req.body;

    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ message: "Se requiere un array de IDs" });
    }

    // Actualizar el orden de cada método
    const updates = orderedIds.map((id, index) => ({
      updateOne: {
        filter: { _id: id, business: req.businessId },
        update: { displayOrder: index + 1 },
      },
    }));

    await PaymentMethod.bulkWrite(updates);

    const methods = await PaymentMethod.find({ business: req.businessId })
      .sort({ displayOrder: 1 })
      .lean();

    res.json({
      message: "Orden actualizado exitosamente",
      paymentMethods: methods,
    });
  } catch (error) {
    console.error("Error al reordenar métodos de pago:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Inicializar métodos de pago por defecto
 * @route   POST /api/payment-methods/initialize
 * @access  Private/Admin
 */
export const initializeDefaultMethods = async (req, res) => {
  try {
    const methods = await PaymentMethod.createDefaultMethods(
      req.businessId,
      req.user?.id
    );

    res.json({
      message: "Métodos de pago inicializados",
      paymentMethods: methods,
    });
  } catch (error) {
    console.error("Error al inicializar métodos de pago:", error);
    res.status(500).json({ message: error.message });
  }
};
