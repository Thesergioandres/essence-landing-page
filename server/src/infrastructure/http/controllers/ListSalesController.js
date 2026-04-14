import {
  resolveFinancialPrivacyContext,
  sanitizeSaleForFinancialPrivacy,
  sanitizeSalesStatsForFinancialPrivacy,
} from "../../../../utils/financialPrivacy.js";
import { listSalesUseCase } from "../../../application/use-cases/sales/buildListSalesUseCase.js";
import { isEmployeeRole } from "../../../utils/roleAliases.js";

/**
 * GET /api/v2/sales
 * List sales with pagination
 */
export async function listSales(req, res) {
  try {
    const businessId = req.businessId || req.headers["x-business-id"];
    if (!businessId) {
      return res
        .status(400)
        .json({ success: false, message: "Falta x-business-id" });
    }

    const {
      page = 1,
      limit = 20,
      branchId,
      productId,
      startDate,
      endDate,
      statsOnly,
      employeeId: employeeIdQuery,
    } = req.query;

    const financialPrivacy = resolveFinancialPrivacyContext(req);

    // Check if this is a employee-specific query
    // Route: /api/v2/sales/employee/:employeeId?
    let employeeId = financialPrivacy.scopeEmployeeId
      ? financialPrivacy.scopeEmployeeId
      : req.params.employeeId || employeeIdQuery;

    // If no employeeId in params, check effective role (membership first)
    // so employee users with admin membership can view team sales.
    const effectiveRole = req.membership?.role || req.user?.role;
    const isEmployeeRoleUser = isEmployeeRole(effectiveRole);
    const canViewTeamSalesByMembership =
      req.membership?.role === "admin" ||
      req.membership?.permissions?.sales?.update === true ||
      req.membership?.permissions?.sales?.delete === true;

    if (!employeeId && isEmployeeRoleUser && !canViewTeamSalesByMembership) {
      employeeId = req.user.id;
    }

    const result = await listSalesUseCase.execute({
      businessId,
      filters: {
        page: Number(page),
        limit: Number(limit),
        branchId,
        employeeId,
        productId,
        startDate,
        endDate,
        statsOnly: statsOnly === "true",
      },
    });

    const sales = financialPrivacy.hideFinancialData
      ? (result.sales || []).map((sale) =>
          sanitizeSaleForFinancialPrivacy(sale),
        )
      : result.sales;

    const stats = financialPrivacy.hideFinancialData
      ? sanitizeSalesStatsForFinancialPrivacy(result.stats || {})
      : result.stats;

    const totalPages = result.totalPages;
    res.json({
      success: true,
      sales,
      stats,
      pagination: {
        page: result.page,
        totalPages: totalPages,
        pages: totalPages, // Alias para compatibilidad con frontend
        total: result.total,
        limit: Number(limit),
        hasMore: result.page < totalPages,
      },
    });
  } catch (error) {
    console.error("Error listing sales:", error);
    res.status(500).json({ success: false, message: error.message });
  }
}
