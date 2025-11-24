import AuditLog from "../models/AuditLog.js";

/**
 * Servicio para registrar logs de auditoría
 */
class AuditService {
  /**
   * Registrar un log de auditoría
   */
  static async log({
    user,
    action,
    module,
    description,
    entityType = null,
    entityId = null,
    entityName = null,
    oldValues = null,
    newValues = null,
    metadata = null,
    severity = "info",
    req = null,
  }) {
    try {
      const logData = {
        user: user._id,
        userEmail: user.email,
        userName: user.name,
        userRole: user.role,
        action,
        module,
        description,
        entityType,
        entityId,
        entityName,
        oldValues,
        newValues,
        metadata,
        severity,
      };

      // Agregar información de request si está disponible
      if (req) {
        logData.ipAddress = req.ip || req.connection.remoteAddress;
        logData.userAgent = req.get("user-agent");
      }

      const auditLog = await AuditLog.create(logData);
      return auditLog;
    } catch (error) {
      console.error("Error al crear log de auditoría:", error);
      // No lanzar error para no interrumpir la operación principal
    }
  }

  /**
   * Log de autenticación
   */
  static async logAuth(user, action, req, success = true) {
    return this.log({
      user: user || { _id: null, email: req.body.email, name: "Unknown", role: "user" },
      action: success ? action : `${action}_failed`,
      module: "auth",
      description: success
        ? `Usuario ${user.email} ${action === "login" ? "inició sesión" : "cerró sesión"}`
        : `Intento fallido de inicio de sesión para ${req.body.email}`,
      severity: success ? "info" : "warning",
      req,
    });
  }

  /**
   * Log de operaciones con productos
   */
  static async logProduct(user, action, product, oldProduct = null, req = null) {
    const descriptions = {
      product_created: `Producto "${product.name}" creado`,
      product_updated: `Producto "${product.name}" actualizado`,
      product_deleted: `Producto "${product.name}" eliminado`,
      product_price_changed: `Precios del producto "${product.name}" modificados`,
    };

    return this.log({
      user,
      action,
      module: "products",
      description: descriptions[action],
      entityType: "Product",
      entityId: product._id,
      entityName: product.name,
      oldValues: oldProduct,
      newValues: product,
      req,
    });
  }

  /**
   * Log de operaciones con categorías
   */
  static async logCategory(user, action, category, oldCategory = null, req = null) {
    const descriptions = {
      category_created: `Categoría "${category.name}" creada`,
      category_updated: `Categoría "${category.name}" actualizada`,
      category_deleted: `Categoría "${category.name}" eliminada`,
    };

    return this.log({
      user,
      action,
      module: "categories",
      description: descriptions[action],
      entityType: "Category",
      entityId: category._id,
      entityName: category.name,
      oldValues: oldCategory,
      newValues: category,
      req,
    });
  }

  /**
   * Log de operaciones con distribuidores
   */
  static async logDistributor(user, action, distributor, req = null) {
    const descriptions = {
      distributor_created: `Distribuidor "${distributor.name}" creado`,
      distributor_updated: `Distribuidor "${distributor.name}" actualizado`,
      distributor_deleted: `Distribuidor "${distributor.name}" eliminado`,
      distributor_activated: `Distribuidor "${distributor.name}" activado`,
      distributor_deactivated: `Distribuidor "${distributor.name}" desactivado`,
    };

    return this.log({
      user,
      action,
      module: "distributors",
      description: descriptions[action],
      entityType: "User",
      entityId: distributor._id,
      entityName: distributor.name,
      req,
    });
  }

  /**
   * Log de operaciones con stock
   */
  static async logStock(user, action, stock, metadata = {}, req = null) {
    const productName = stock.product?.name || metadata.productName || "Producto";
    const distributorName = stock.distributor?.name || metadata.distributorName || "Distribuidor";
    const quantity = metadata.quantity || stock.quantity;

    const descriptions = {
      stock_assigned: `${quantity} unidades de "${productName}" asignadas a ${distributorName}`,
      stock_withdrawn: `${quantity} unidades de "${productName}" retiradas de ${distributorName}`,
      stock_adjusted: `Stock de "${productName}" ajustado para ${distributorName}`,
    };

    return this.log({
      user,
      action,
      module: "stock",
      description: descriptions[action],
      entityType: "DistributorStock",
      entityId: stock._id,
      metadata: {
        productId: stock.product?._id || metadata.productId,
        productName,
        distributorId: stock.distributor?._id || metadata.distributorId,
        distributorName,
        quantity,
        ...metadata,
      },
      req,
    });
  }

  /**
   * Log de operaciones con ventas
   */
  static async logSale(user, action, sale, metadata = {}, req = null) {
    const productName = sale.product?.name || metadata.productName || "Producto";
    const quantity = sale.quantity;

    const descriptions = {
      sale_registered: `Venta registrada: ${quantity} unidades de "${productName}"`,
      payment_confirmed: `Pago confirmado para venta de "${productName}"`,
      payment_rejected: `Pago rechazado para venta de "${productName}"`,
    };

    return this.log({
      user,
      action,
      module: "sales",
      description: descriptions[action],
      entityType: "Sale",
      entityId: sale._id,
      metadata: {
        productId: sale.product?._id || metadata.productId,
        productName,
        quantity,
        salePrice: sale.salePrice,
        totalProfit: sale.totalProfit,
        ...metadata,
      },
      req,
    });
  }

  /**
   * Log de productos defectuosos
   */
  static async logDefective(user, action, defective, metadata = {}, req = null) {
    const productName = defective.product?.name || metadata.productName || "Producto";
    const quantity = defective.quantity;

    const descriptions = {
      defective_reported: `Reporte de ${quantity} unidades defectuosas de "${productName}"`,
      defective_confirmed: `Confirmado reporte de productos defectuosos: ${quantity} unidades de "${productName}"`,
      defective_rejected: `Rechazado reporte de productos defectuosos: ${quantity} unidades de "${productName}"`,
    };

    return this.log({
      user,
      action,
      module: "defective_products",
      description: descriptions[action],
      entityType: "DefectiveProduct",
      entityId: defective._id,
      metadata: {
        productId: defective.product?._id || metadata.productId,
        productName,
        quantity,
        reason: defective.reason,
        ...metadata,
      },
      severity: action === "defective_rejected" ? "warning" : "info",
      req,
    });
  }

  /**
   * Log de exportación de datos
   */
  static async logExport(user, exportType, metadata = {}, req = null) {
    return this.log({
      user,
      action: "data_exported",
      module: "analytics",
      description: `Datos exportados: ${exportType}`,
      metadata: {
        exportType,
        ...metadata,
      },
      req,
    });
  }
}

export default AuditService;
