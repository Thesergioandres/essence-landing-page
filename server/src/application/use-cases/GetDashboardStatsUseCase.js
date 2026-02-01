import { AnalyticsService } from "../../domain/services/AnalyticsService.js";
import { AnalyticsRepository } from "../../infrastructure/database/repositories/AnalyticsRepository.js";

export class GetDashboardStatsUseCase {
  constructor() {
    this.repository = new AnalyticsRepository();
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
    const [kpi, timeline] = await Promise.all([
      this.repository.getDashboardKPIs(businessId, start, end),
      this.repository.getSalesTimeline(businessId, start, end),
    ]);

    // 3. Format Data
    const charts = AnalyticsService.formatChartData(timeline);

    return {
      period: { start, end },
      kpi,
      charts,
    };
  }
}
