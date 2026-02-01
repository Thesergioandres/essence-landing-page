export class AnalyticsService {
  /**
   * Format timeline data for frontend charts
   * @param {Array} timelineData
   * @returns {Object} { labels: [], revenue: [], profit: [] }
   */
  static formatChartData(timelineData) {
    const labels = [];
    const revenue = [];
    const profit = [];

    // Assuming timelineData is sorted by date
    timelineData.forEach((day) => {
      labels.push(day._id); // YYYY-MM-DD
      revenue.push(day.revenue);
      profit.push(day.profit);
    });

    return { labels, revenue, profit };
  }

  /**
   * Get Standard Date Ranges
   * @returns {Object} { today: [start, end], thisMonth: ... }
   */
  static getDateRanges() {
    const now = new Date();

    // Today
    const startToday = new Date(now);
    startToday.setHours(0, 0, 0, 0);
    const endToday = new Date(now);
    endToday.setHours(23, 59, 59, 999);

    return {
      today: { start: startToday, end: endToday },
    };
  }
}
