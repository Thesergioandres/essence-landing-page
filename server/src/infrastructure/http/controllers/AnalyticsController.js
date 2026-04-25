import { GetDashboardStatsUseCase } from "../../../application/use-cases/GetDashboardStatsUseCase.js";
import { AnalyticsPersistenceUseCase } from "../../../application/use-cases/repository-gateways/AnalyticsPersistenceUseCase.js";

/**
 * Get Dashboard Stats
 */
export const getDashboardStats = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    // businessId from header or auth token
    const businessId = req.headers["x-business-id"] || req.user.business;

    // Authorization check could be here (isAdmin)

    const useCase = new GetDashboardStatsUseCase();
    const stats = await useCase.execute(businessId, startDate, endDate);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Estimated Profit
 */
export const getEstimatedProfit = async (req, res, next) => {
  try {
    const businessId = req.headers["x-business-id"] || req.user.business;

    const repository = new AnalyticsPersistenceUseCase();
    const estimatedProfit = await repository.getEstimatedProfit(businessId);

    res.json({
      success: true,
      data: estimatedProfit,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Employee Estimated Profit
 * Calcula la ganancia estimada del employee basándose en sus ventas
 */
export const getEmployeeEstimatedProfit = async (req, res, next) => {
  try {
    const businessId =
      req.businessId || req.headers["x-business-id"] || req.user.business;
    const employeeId = req.query.employeeId || req.user.id || req.user._id;

    const repository = new AnalyticsPersistenceUseCase();
    const estimatedProfit = await repository.getEmployeeEstimatedProfit(
      businessId,
      employeeId,
    );

    res.json({
      success: true,
      data: estimatedProfit,
    });
  } catch (error) {
    next(error);
  }
};
