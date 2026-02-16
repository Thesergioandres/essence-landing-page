import { SaleRepository } from "../../database/repositories/SaleRepository.js";

const saleRepository = new SaleRepository();

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

    // Check if this is a distributor-specific query
    // Route: /api/v2/sales/distributor/:distributorId?
    let distributorId = req.params.distributorId || distributorIdQuery;

    // If no distributorId in params, check if current user is distributor
    // Note: Role is 'distribuidor' in Spanish in the database
    if (!distributorId && req.user?.role === "distribuidor") {
      distributorId = req.user.id;
    }

    const result = await saleRepository.list(businessId, {
      page: Number(page),
      limit: Number(limit),
      branchId,
      distributorId, // Pass distributorId to filter
      productId,
      startDate,
      endDate,
      statsOnly: statsOnly === "true",
    });

    const totalPages = result.totalPages;
    res.json({
      success: true,
      sales: result.sales,
      stats: result.stats,
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
