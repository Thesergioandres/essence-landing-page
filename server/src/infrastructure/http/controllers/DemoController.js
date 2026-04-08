import { SetupDemoTenantUseCase } from "../../../application/use-cases/SetupDemoTenantUseCase.js";
import { TeardownDemoTenantUseCase } from "../../../application/use-cases/TeardownDemoTenantUseCase.js";

const setupUseCase = new SetupDemoTenantUseCase();
const teardownUseCase = new TeardownDemoTenantUseCase();

const isDemoSandboxEnabled = () => {
  if (process.env.DEMO_SANDBOX_ENABLED === "true") {
    return true;
  }

  return process.env.NODE_ENV !== "production";
};

export const setupDemoSandbox = async (req, res) => {
  try {
    if (!isDemoSandboxEnabled()) {
      return res.status(403).json({
        success: false,
        message: "Demo sandbox deshabilitado en este entorno",
      });
    }

    const result = await setupUseCase.execute({
      ip: req.ip,
      userAgent: req.headers["user-agent"] || null,
    });

    return res.status(201).json({
      success: true,
      data: result,
      message: "Sandbox demo creado correctamente",
    });
  } catch (error) {
    console.error("[DemoController.setupDemoSandbox]", error);
    return res.status(500).json({
      success: false,
      message: "No se pudo crear el entorno demo",
      error: error.message,
    });
  }
};

export const teardownDemoSandbox = async (req, res) => {
  try {
    if (!isDemoSandboxEnabled()) {
      return res.status(403).json({
        success: false,
        message: "Demo sandbox deshabilitado en este entorno",
      });
    }

    if (!req.businessId || !req.business) {
      return res.status(400).json({
        success: false,
        message: "No se encontro contexto de negocio demo",
      });
    }

    if (req.business.isDemo !== true) {
      return res.status(403).json({
        success: false,
        message: "Solo los negocios demo pueden ejecutar teardown",
      });
    }

    const result = await teardownUseCase.execute({
      businessId: req.businessId,
      requestedBy: req.user?.id,
      reason: "manual_teardown",
    });

    return res.json({
      success: true,
      data: result,
      message: "Sandbox demo eliminado",
    });
  } catch (error) {
    console.error("[DemoController.teardownDemoSandbox]", error);
    return res.status(500).json({
      success: false,
      message: "No se pudo eliminar el entorno demo",
      error: error.message,
    });
  }
};
