import { GetDashboardStatsUseCase } from "../../../application/use-cases/GetDashboardStatsUseCase.js";

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
