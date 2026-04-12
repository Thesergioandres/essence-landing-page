import { EmployeePersistenceUseCase } from "../../../application/use-cases/repository-gateways/EmployeePersistenceUseCase.js";

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
      res.status(500).json({ success: false, message: error.message });
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

      // V2 API: devolver objeto completo con products, pagination, total
      res.json({
        success: true,
        data: {
          products: result.products,
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
      res.json({
        success: true,
        products: result.products,
        employee: result.employee,
        business: result.business || null,
      });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }
}
