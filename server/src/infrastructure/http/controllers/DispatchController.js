import { resolveFinancialPrivacyContext } from "../../../../utils/financialPrivacy.js";
import { dispatchUseCases } from "../../../application/use-cases/dispatch/buildDispatchUseCases.js";
import { isEmployeeRole } from "../../../utils/roleAliases.js";

const isDistributorRole = (role) => isEmployeeRole(role);

const isGodRole = (role) => role === "god";

const resolveBusinessId = (req) =>
  req.businessId || req.headers["x-business-id"];

const resolveErrorStatus = (error) => {
  if (error?.statusCode) return error.statusCode;
  if (error?.name === "ValidationError") return 400;
  if (error?.name === "CastError") return 400;
  return 400;
};

const {
  createDispatchRequestUseCase,
  listDispatchRequestsUseCase,
  getDispatchByIdUseCase,
  markDispatchAsDispatchedUseCase,
  confirmDispatchReceptionUseCase,
  getPendingDispatchCountUseCase,
  getDispatchHotSectorsUseCase,
} = dispatchUseCases;

export class DispatchController {
  async createRequest(req, res) {
    try {
      const businessId = resolveBusinessId(req);
      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, message: "Falta x-business-id" });
      }

      const effectiveRole = req.membership?.role || req.user?.role;
      const payload = { ...(req.body || {}) };

      if (isDistributorRole(effectiveRole)) {
        payload.distributorId = String(req.user?._id || req.user?.id || "");
      }

      const request = await createDispatchRequestUseCase.execute({
        data: payload,
        businessId,
        requesterId: req.user._id,
      });

      return res.status(201).json({ success: true, data: request });
    } catch (error) {
      const status = resolveErrorStatus(error);
      return res
        .status(status)
        .json({ success: false, message: error.message });
    }
  }

  async listRequests(req, res) {
    try {
      const businessId = resolveBusinessId(req);
      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, message: "Falta x-business-id" });
      }

      const privacyContext = resolveFinancialPrivacyContext(req);
      const filters = { ...(req.query || {}) };

      if (privacyContext.scopeDistributorId) {
        filters.distributorId = privacyContext.scopeDistributorId;
      }

      const result = await listDispatchRequestsUseCase.execute({
        businessId,
        filters,
      });

      return res.json({
        success: true,
        data: result.requests,
        pagination: result.pagination,
      });
    } catch (error) {
      const status = resolveErrorStatus(error);
      return res
        .status(status)
        .json({ success: false, message: error.message });
    }
  }

  async getById(req, res) {
    try {
      const businessId = resolveBusinessId(req);
      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, message: "Falta x-business-id" });
      }

      const request = await getDispatchByIdUseCase.execute({
        requestId: req.params.id,
        businessId,
      });

      if (!request) {
        return res.status(404).json({
          success: false,
          message: "Solicitud de despacho no encontrada",
        });
      }

      const effectiveRole = req.membership?.role || req.user?.role;
      if (
        isDistributorRole(effectiveRole) &&
        String(request.distributor?._id || request.distributor) !==
          String(req.user?._id || req.user?.id)
      ) {
        return res.status(403).json({
          success: false,
          message: "No tienes acceso a este despacho",
        });
      }

      return res.json({ success: true, data: request });
    } catch (error) {
      const status = resolveErrorStatus(error);
      return res
        .status(status)
        .json({ success: false, message: error.message });
    }
  }

  async markAsDispatched(req, res) {
    try {
      const businessId = resolveBusinessId(req);
      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, message: "Falta x-business-id" });
      }

      const request = await markDispatchAsDispatchedUseCase.execute({
        requestId: req.params.id,
        businessId,
        userId: req.user._id,
        payload: req.body || {},
      });

      return res.json({ success: true, data: request });
    } catch (error) {
      const status = resolveErrorStatus(error);
      return res
        .status(status)
        .json({ success: false, message: error.message });
    }
  }

  async confirmReception(req, res) {
    try {
      const businessId = resolveBusinessId(req);
      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, message: "Falta x-business-id" });
      }

      const isGodUser =
        isGodRole(req.user?.role) || isGodRole(req.membership?.role);

      const request = await confirmDispatchReceptionUseCase.execute({
        requestId: req.params.id,
        businessId,
        userId: req.user._id,
        allowGodBypass: isGodUser,
      });

      return res.json({ success: true, data: request });
    } catch (error) {
      const status = resolveErrorStatus(error);
      return res
        .status(status)
        .json({ success: false, message: error.message });
    }
  }

  async getPendingCount(req, res) {
    try {
      const businessId = resolveBusinessId(req);
      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, message: "Falta x-business-id" });
      }

      const privacyContext = resolveFinancialPrivacyContext(req);
      const pendingCount = await getPendingDispatchCountUseCase.execute({
        businessId,
        options: {
          distributorId: privacyContext.scopeDistributorId || undefined,
        },
      });

      return res.json({ success: true, data: { pendingCount } });
    } catch (error) {
      const status = resolveErrorStatus(error);
      return res
        .status(status)
        .json({ success: false, message: error.message });
    }
  }

  async getHotSectors(req, res) {
    try {
      const businessId = resolveBusinessId(req);
      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, message: "Falta x-business-id" });
      }

      const privacyContext = resolveFinancialPrivacyContext(req);
      const result = await getDispatchHotSectorsUseCase.execute({
        businessId,
        options: {
          startDate: req.query?.startDate,
          endDate: req.query?.endDate,
          limit: req.query?.limit,
          includeFinancialMargins: true,
          hideFinancialData: privacyContext.hideFinancialData,
        },
      });

      if (privacyContext.scopeDistributorId) {
        result.distributors = (result.distributors || []).filter(
          (item) => item.zoneId === String(privacyContext.scopeDistributorId),
        );
      }

      return res.json({ success: true, data: result });
    } catch (error) {
      const status = resolveErrorStatus(error);
      return res
        .status(status)
        .json({ success: false, message: error.message });
    }
  }
}

export default new DispatchController();
