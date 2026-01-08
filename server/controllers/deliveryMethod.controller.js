import DeliveryMethod from "../models/DeliveryMethod.js";

/**
 * @desc    Obtener todos los métodos de entrega del negocio
 * @route   GET /api/delivery-methods
 * @access  Private
 */
export const getDeliveryMethods = async (req, res) => {
  try {
    const { includeInactive } = req.query;

    const query = { business: req.businessId };
    if (!includeInactive) {
      query.isActive = true;
    }

    const methods = await DeliveryMethod.find(query)
      .sort({ displayOrder: 1, createdAt: 1 })
      .lean();

    // Si no hay métodos, crear los por defecto
    if (methods.length === 0) {
      const defaultMethods = await DeliveryMethod.createDefaultMethods(
        req.businessId,
        req.user?.id
      );
      return res.json({ deliveryMethods: defaultMethods });
    }

    res.json({ deliveryMethods: methods });
  } catch (error) {
    console.error("Error al obtener métodos de entrega:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Obtener un método de entrega por ID
 * @route   GET /api/delivery-methods/:id
 * @access  Private
 */
export const getDeliveryMethodById = async (req, res) => {
  try {
    const method = await DeliveryMethod.findOne({
      _id: req.params.id,
      business: req.businessId,
    });

    if (!method) {
      return res
        .status(404)
        .json({ message: "Método de entrega no encontrado" });
    }

    res.json({ deliveryMethod: method });
  } catch (error) {
    console.error("Error al obtener método de entrega:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Crear un nuevo método de entrega
 * @route   POST /api/delivery-methods
 * @access  Private/Admin
 */
export const createDeliveryMethod = async (req, res) => {
  try {
    const {
      name,
      description,
      defaultCost,
      hasVariableCost,
      requiresAddress,
      estimatedTime,
      icon,
      color,
      displayOrder,
    } = req.body;

    if (!name) {
      return res.status(400).json({ message: "El nombre es obligatorio" });
    }

    // Verificar que no exista uno con el mismo nombre
    const existingByName = await DeliveryMethod.findOne({
      business: req.businessId,
      name: { $regex: new RegExp(`^${name}$`, "i") },
    });

    if (existingByName) {
      return res.status(400).json({
        message: "Ya existe un método de entrega con ese nombre",
      });
    }

    // Obtener el orden máximo para asignar el siguiente
    const maxOrder = await DeliveryMethod.findOne({ business: req.businessId })
      .sort({ displayOrder: -1 })
      .select("displayOrder")
      .lean();

    const newMethod = await DeliveryMethod.create({
      business: req.businessId,
      name,
      description,
      defaultCost: defaultCost || 0,
      hasVariableCost: hasVariableCost || false,
      requiresAddress: requiresAddress || false,
      estimatedTime,
      icon: icon || "truck",
      color: color || "#8B5CF6",
      displayOrder: displayOrder || (maxOrder?.displayOrder || 0) + 1,
      isSystem: false,
      createdBy: req.user?.id,
    });

    res.status(201).json({
      message: "Método de entrega creado exitosamente",
      deliveryMethod: newMethod,
    });
  } catch (error) {
    console.error("Error al crear método de entrega:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Actualizar un método de entrega
 * @route   PUT /api/delivery-methods/:id
 * @access  Private/Admin
 */
export const updateDeliveryMethod = async (req, res) => {
  try {
    const method = await DeliveryMethod.findOne({
      _id: req.params.id,
      business: req.businessId,
    });

    if (!method) {
      return res
        .status(404)
        .json({ message: "Método de entrega no encontrado" });
    }

    // Para métodos del sistema, solo permitir cambiar algunos campos
    if (method.isSystem) {
      const allowedFields = [
        "isActive",
        "displayOrder",
        "defaultCost",
        "description",
      ];
      const updates = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          message:
            "Solo puedes modificar el estado, orden, costo y descripción de los métodos del sistema",
        });
      }

      Object.assign(method, updates);
    } else {
      // Para métodos personalizados, permitir editar todo excepto code e isSystem
      const {
        name,
        description,
        defaultCost,
        hasVariableCost,
        requiresAddress,
        estimatedTime,
        icon,
        color,
        isActive,
        displayOrder,
      } = req.body;

      if (name !== undefined) {
        // Verificar nombre único
        const existingByName = await DeliveryMethod.findOne({
          business: req.businessId,
          name: { $regex: new RegExp(`^${name}$`, "i") },
          _id: { $ne: method._id },
        });

        if (existingByName) {
          return res.status(400).json({
            message: "Ya existe un método de entrega con ese nombre",
          });
        }
        method.name = name;
      }

      if (description !== undefined) method.description = description;
      if (defaultCost !== undefined) method.defaultCost = defaultCost;
      if (hasVariableCost !== undefined)
        method.hasVariableCost = hasVariableCost;
      if (requiresAddress !== undefined)
        method.requiresAddress = requiresAddress;
      if (estimatedTime !== undefined) method.estimatedTime = estimatedTime;
      if (icon !== undefined) method.icon = icon;
      if (color !== undefined) method.color = color;
      if (isActive !== undefined) method.isActive = isActive;
      if (displayOrder !== undefined) method.displayOrder = displayOrder;
    }

    await method.save();

    res.json({
      message: "Método de entrega actualizado exitosamente",
      deliveryMethod: method,
    });
  } catch (error) {
    console.error("Error al actualizar método de entrega:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Eliminar un método de entrega
 * @route   DELETE /api/delivery-methods/:id
 * @access  Private/Admin
 */
export const deleteDeliveryMethod = async (req, res) => {
  try {
    const method = await DeliveryMethod.findOne({
      _id: req.params.id,
      business: req.businessId,
    });

    if (!method) {
      return res
        .status(404)
        .json({ message: "Método de entrega no encontrado" });
    }

    // No permitir eliminar métodos del sistema
    if (method.isSystem) {
      return res.status(400).json({
        message:
          "No se pueden eliminar los métodos de entrega del sistema. Puedes desactivarlo en su lugar.",
      });
    }

    // Verificar si hay ventas con este método de entrega
    const Sale = (await import("../models/Sale.js")).default;
    const salesCount = await Sale.countDocuments({
      business: req.businessId,
      deliveryMethod: method._id,
    });

    if (salesCount > 0) {
      return res.status(400).json({
        message: `No se puede eliminar porque hay ${salesCount} venta(s) registrada(s) con este método de entrega. Puedes desactivarlo en su lugar.`,
      });
    }

    await DeliveryMethod.findByIdAndDelete(method._id);

    res.json({ message: "Método de entrega eliminado exitosamente" });
  } catch (error) {
    console.error("Error al eliminar método de entrega:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Reordenar métodos de entrega
 * @route   PUT /api/delivery-methods/reorder
 * @access  Private/Admin
 */
export const reorderDeliveryMethods = async (req, res) => {
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

    await DeliveryMethod.bulkWrite(updates);

    const methods = await DeliveryMethod.find({ business: req.businessId })
      .sort({ displayOrder: 1 })
      .lean();

    res.json({
      message: "Orden actualizado exitosamente",
      deliveryMethods: methods,
    });
  } catch (error) {
    console.error("Error al reordenar métodos de entrega:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Inicializar métodos de entrega por defecto
 * @route   POST /api/delivery-methods/initialize
 * @access  Private/Admin
 */
export const initializeDefaultMethods = async (req, res) => {
  try {
    const methods = await DeliveryMethod.createDefaultMethods(
      req.businessId,
      req.user?.id
    );

    res.json({
      message: "Métodos de entrega inicializados",
      deliveryMethods: methods,
    });
  } catch (error) {
    console.error("Error al inicializar métodos de entrega:", error);
    res.status(500).json({ message: error.message });
  }
};
