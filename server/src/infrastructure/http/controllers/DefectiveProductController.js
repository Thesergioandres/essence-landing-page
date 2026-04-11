import { DefectiveProductPersistenceUseCase } from "../../../application/use-cases/repository-gateways/DefectiveProductPersistenceUseCase.js";

const repository = new DefectiveProductPersistenceUseCase();

export class DefectiveProductController {
  async reportAdmin(req, res) {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, message: "Falta x-business-id" });
      }

      const report = await repository.reportFromAdmin(
        req.body,
        businessId,
        req.user._id,
      );
      res.status(201).json({ success: true, data: report });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  async reportDistributor(req, res) {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, message: "Falta x-business-id" });
      }

      const report = await repository.reportFromDistributor(
        req.body,
        businessId,
        req.user._id,
      );
      res.status(201).json({ success: true, data: report });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  async reportFromBranch(req, res) {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, message: "Falta x-business-id" });
      }

      const role = req.membership?.role || req.user?.role;
      const isDistributor = role === "distribuidor";

      if (isDistributor) {
        const allowedBranches = Array.isArray(req.membership?.allowedBranches)
          ? req.membership.allowedBranches.map((id) => id.toString())
          : [];
        const branchId = req.body?.branchId;
        if (!branchId || !allowedBranches.includes(branchId.toString())) {
          return res.status(403).json({
            success: false,
            message: "No tienes acceso a esta sede",
          });
        }
      }

      const report = await repository.reportFromBranch(
        req.body,
        businessId,
        req.user._id,
        { isDistributor },
      );
      res.status(201).json({ success: true, data: report });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  async getDistributorReports(req, res) {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, message: "Falta x-business-id" });
      }

      const distributorId =
        req.params.distributorId || req.user?._id || req.user?.id;

      if (!distributorId) {
        return res
          .status(400)
          .json({ success: false, message: "Falta distribuidor" });
      }

      const result = await repository.findByBusiness(businessId, {
        distributor: distributorId,
        status: req.query.status,
      });

      res.json({ success: true, data: result.reports });
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
        data: result.reports,
        pagination: result.pagination,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getById(req, res) {
    try {
      const businessId = req.businessId;
      const report = await repository.findById(req.params.id, businessId);

      if (!report) {
        return res
          .status(404)
          .json({ success: false, message: "Reporte no encontrado" });
      }

      res.json({ success: true, data: report });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async confirm(req, res) {
    try {
      const businessId = req.businessId;
      const report = await repository.confirmReport(
        req.params.id,
        businessId,
        req.user._id,
        req.body,
      );
      res.json({ success: true, data: report });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  async reject(req, res) {
    try {
      const businessId = req.businessId;
      const report = await repository.rejectReport(
        req.params.id,
        businessId,
        req.user._id,
        req.body,
      );
      res.json({ success: true, data: report });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  async getStats(req, res) {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, message: "Falta x-business-id" });
      }

      const stats = await repository.getStats(businessId);
      res.json({ success: true, stats });
    } catch (error) {
      console.error("[DefectiveProduct] Error in getStats:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getSaleLookup(req, res) {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, message: "Falta x-business-id" });
      }

      const lookup = req.params.saleId || req.query.saleId;
      const result = await repository.getSaleLookup(businessId, lookup, {
        ...req.user,
        membership: req.membership,
      });

      res.json({ success: true, data: result });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  async createCustomerWarranty(req, res) {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, message: "Falta x-business-id" });
      }

      const role = req.membership?.role;
      const isDistributor = role === "distribuidor";
      const replacementSource = req.body?.replacementSource;

      if (isDistributor && replacementSource === "warehouse") {
        return res.status(403).json({
          success: false,
          message: "No tienes acceso a la bodega",
        });
      }

      if (isDistributor && replacementSource === "branch") {
        const allowedBranches = Array.isArray(req.membership?.allowedBranches)
          ? req.membership.allowedBranches.map((id) => id.toString())
          : [];
        const branchId = req.body?.replacementBranchId;
        if (!branchId || !allowedBranches.includes(branchId.toString())) {
          return res.status(403).json({
            success: false,
            message: "No tienes acceso a esta sede",
          });
        }
      }

      const result = await repository.createCustomerWarranty(
        req.body,
        businessId,
        {
          ...req.user,
          membership: req.membership,
        },
      );

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  async resolveCustomerWarranty(req, res) {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, message: "Falta x-business-id" });
      }

      const role = req.membership?.role;
      if (role === "distribuidor") {
        return res.status(403).json({
          success: false,
          message: "No tienes permiso para resolver garantias",
        });
      }

      const report = await repository.resolveCustomerWarranty(
        req.params.id,
        businessId,
        req.user._id,
        req.body,
      );

      res.json({ success: true, data: report });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  async cancel(req, res) {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, message: "Falta x-business-id" });
      }

      const result = await repository.cancelReport(req.params.id, businessId);
      res.json({ success: true, data: result });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  async approveWarranty(req, res) {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, message: "Falta x-business-id" });
      }

      const result = await repository.approveWarranty(
        req.params.id,
        businessId,
        req.user._id,
        req.body,
      );
      res.json({
        success: true,
        message: "Garantía aprobada",
        report: result.report,
        newStock: result.newStock,
      });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  async rejectWarranty(req, res) {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, message: "Falta x-business-id" });
      }

      const result = await repository.rejectWarranty(
        req.params.id,
        businessId,
        req.user._id,
        req.body,
      );
      res.json({
        success: true,
        message: "Garantía rechazada",
        report: result.report,
        lossAmount: result.lossAmount,
      });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }
}
