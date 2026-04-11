import { AnalyticsService } from "../../domain/services/AnalyticsService.js";
import { AnalyticsPersistenceUseCase } from "./repository-gateways/AnalyticsPersistenceUseCase.js";

export class GetDashboardStatsUseCase {
  constructor() {
    this.repository = new AnalyticsPersistenceUseCase();
  }

  async execute(businessId, startDateStr, endDateStr) {
    // 1. Parse Dates (Default to Today if missing)
    let start, end;
    if (startDateStr && endDateStr) {
      start = new Date(startDateStr);
      end = new Date(endDateStr);
      end.setHours(23, 59, 59, 999); // Ensure end of day coverage if generic date
    } else {
      const ranges = AnalyticsService.getDateRanges();
      start = ranges.today.start;
      end = ranges.today.end;
    }

    // 2. Fetch Data (Parallel)
    const [kpi, timeline, topProducts] = await Promise.all([
      this.repository.getDashboardKPIs(businessId, start, end),
      this.repository.getSalesTimeline(businessId, start, end),
      this.repository.getTopProducts
        ? this.repository.getTopProducts(businessId, start, end)
        : [],
    ]);

    // 3. Format timeline for frontend
    const salesTimeline = timeline.map((day) => ({
      date: day._id,
      revenue: day.revenue || 0,
      profit: day.profit || 0,
    }));

    // 4. Calculate average ticket
    const averageTicket =
      kpi.totalSales > 0
        ? Math.round((kpi.totalRevenue / kpi.totalSales) * 100) / 100
        : 0;

    // 5. Return in frontend expected format
    return {
      totalRevenue: kpi.totalRevenue || 0,
      totalNetProfit: kpi.totalProfit || 0,
      totalSalesCount: kpi.totalSales || 0,
      averageTicket,
      salesTimeline,
      topProducts: topProducts || [],
    };
  }
}
