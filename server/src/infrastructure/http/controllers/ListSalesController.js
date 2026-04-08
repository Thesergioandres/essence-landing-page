import {
  resolveFinancialPrivacyContext,
  sanitizeSaleForFinancialPrivacy,
  sanitizeSalesStatsForFinancialPrivacy,
} from "../../../../utils/financialPrivacy.js";
import ListSalesUseCase from "../../../application/use-cases/sales/ListSalesUseCase.js";
import SaleReadRepositoryAdapter from "../../adapters/repositories/SaleReadRepositoryAdapter.js";

const saleReadRepository = new SaleReadRepositoryAdapter();
const listSalesUseCase = new ListSalesUseCase(saleReadRepository);

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
      distributorId: distributorIdQuery,
    } = req.query;

    const financialPrivacy = resolveFinancialPrivacyContext(req);

    // Check if this is a distributor-specific query
    // Route: /api/v2/sales/distributor/:distributorId?
    let distributorId = financialPrivacy.scopeDistributorId
      ? financialPrivacy.scopeDistributorId
      : req.params.distributorId || distributorIdQuery;

    // If no distributorId in params, check effective role (membership first)
    // so distributor users with admin membership can view team sales.
    const effectiveRole = req.membership?.role || req.user?.role;
    const isDistributorRole =
      effectiveRole === "distribuidor" || effectiveRole === "distributor";
    const canViewTeamSalesByMembership =
      req.membership?.role === "admin" ||
      req.membership?.permissions?.sales?.update === true ||
      req.membership?.permissions?.sales?.delete === true;

    if (!distributorId && isDistributorRole && !canViewTeamSalesByMembership) {
      distributorId = req.user.id;
    }

    const result = await listSalesUseCase.execute({
      businessId,
      filters: {
        page: Number(page),
        limit: Number(limit),
        branchId,
        distributorId,
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
