import { EmployeePersistenceUseCase } from "../../../application/use-cases/repository-gateways/EmployeePersistenceUseCase.js";
import { getBusinessBaseCommissionPercentage, applyDynamicEmployeePricingToProduct } from "../../services/productPricing.service.js";

const repository = new EmployeePersistenceUseCase();

export class EmployeeController {
  async create(req, res) {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, message: "Falta x-business-id" });
      }

      const employee = await repository.create(req.body, businessId);
      res.status(201).json({ success: true, data: employee });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  async getAll(req, res) {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, message: "Falta x-business-id" });
      }

      const result = await repository.findByBusiness(businessId, req.query);
      res.json({
        success: true,
        data: result.employees,
        pagination: result.pagination,
      });
    } catch (error) {
      const requestId = req.requestId || req.id || "N/A";
      console.error(`[EmployeeController.getAll] [RequestID: ${requestId}] ERROR:`, {
        message: error.message,
        stack: error.stack,
        businessId: req.businessId,
        query: req.query,
      });

      const status = error.statusCode || 500;
      res.status(status).json({
        success: false,
        message: error.message || "Error interno al obtener empleados",
        requestId, // Devolver el requestId ayuda a trackear logs en producción
      });
    }
  }

  async getById(req, res) {
    try {
      const businessId = req.businessId;
      const employee = await repository.findById(req.params.id, businessId);
      res.json({ success: true, data: employee });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  async update(req, res) {
    try {
      const businessId = req.businessId;
      const employee = await repository.update(
        req.params.id,
        businessId,
        req.body,
      );
      res.json({ success: true, data: employee });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  async updateBaseCommissionPercentage(req, res) {
    try {
      const businessId = req.businessId;
      const { baseCommissionPercentage } = req.body || {};
      const targetRoleFromHeader = req.headers["x-target-role"];

      const employee = await repository.updateBaseCommissionPercentage(
        req.params.id,
        businessId,
        baseCommissionPercentage,
        {
          targetRoleFromHeader,
        },
      );

      return res.json({ success: true, data: employee });
    } catch (error) {
      const status = error.statusCode || 500;
      return res
        .status(status)
        .json({ success: false, message: error.message });
    }
  }

  async delete(req, res) {
    try {
      const businessId = req.businessId;
      const result = await repository.delete(
        req.params.id,
        businessId,
        req.user?.id || req.user?._id,
      );
      res.json({ success: true, data: result, message: result.message });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  async toggleActive(req, res) {
    try {
      const businessId = req.businessId;
      const result = await repository.toggleActive(req.params.id, businessId);
      res.json({ success: true, data: result, message: result.message });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  async assignProducts(req, res) {
    try {
      const businessId = req.businessId;
      const { productIds } = req.body;

      if (!Array.isArray(productIds)) {
        return res
          .status(400)
          .json({ success: false, message: "productIds debe ser un array" });
      }

      const employee = await repository.assignProducts(
        req.params.id,
        businessId,
        productIds,
      );
      res.json({ success: true, data: employee });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  async getProducts(req, res) {
    try {
      const businessId = req.businessId;
      // Determine employee ID: if param exists use it (admin view), otherwise use logged in user (staff view)
      const employeeId = req.params.id || req.user.id;

      const result = await repository.getProducts(
        employeeId,
        businessId,
        req.query,
      );

      const baseCommissionPercentage = await getBusinessBaseCommissionPercentage(businessId);
      const stockWithDynamicPricing = result.products.map(item => {
        if (item.product) {
          item.product = applyDynamicEmployeePricingToProduct(item.product, baseCommissionPercentage);
        }
        return item;
      });

      // V2 API: devolver objeto completo con products, pagination, total
      res.json({
        success: true,
        data: {
          products: stockWithDynamicPricing,
          pagination: result.pagination,
          total: result.total,
        },
      });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  async getPublicCatalog(req, res) {
    try {
      const { id } = req.params;
      const result = await repository.getPublicCatalog(id);
      
      const businessId = result.business?._id;
      let stockWithDynamicPricing = result.products;
      if (businessId) {
        const baseCommissionPercentage = await getBusinessBaseCommissionPercentage(businessId);
        stockWithDynamicPricing = result.products.map(item => {
          return applyDynamicEmployeePricingToProduct(item, baseCommissionPercentage);
        });
      }

      res.json({
        success: true,
        products: stockWithDynamicPricing,
        employee: result.employee,
        business: result.business || null,
      });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }
}
