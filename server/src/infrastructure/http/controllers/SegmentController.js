/**
 * Segment Controller - HTTP Layer
 * Handles customer segment HTTP requests
 */

import segmentPersistenceUseCase from "../../../application/use-cases/repository-gateways/SegmentPersistenceUseCase.js";

class SegmentController {
  /**
   * POST /api/v2/segments
   * Create new segment
   */
  async create(req, res) {
    try {
      const businessId = req.businessId;

      const segment = await segmentPersistenceUseCase.create(
        businessId,
        req.body,
        req.user,
      );

      res.status(201).json({
        success: true,
        data: { segment },
        message: "Segmento creado correctamente",
      });
    } catch (error) {
      console.error("Error creating segment:", error);

      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: "La clave del segmento ya existe",
        });
      }

      res.status(500).json({
        success: false,
        message: error.message || "Error al crear segmento",
      });
    }
  }

  /**
   * GET /api/v2/segments
   * Get all segments
   */
  async getAll(req, res) {
    try {
      const businessId = req.businessId;

      const segments = await segmentPersistenceUseCase.findByBusiness(businessId);

      res.json({
        success: true,
        data: { segments },
      });
    } catch (error) {
      console.error("Error getting segments:", error);
      res.status(500).json({
        success: false,
        message: "Error al obtener segmentos",
      });
    }
  }

  /**
   * GET /api/v2/segments/:id
   * Get segment by ID
   */
  async getById(req, res) {
    try {
      const { id } = req.params;
      const businessId = req.businessId;

      const segment = await segmentPersistenceUseCase.findById(id, businessId);

      if (!segment) {
        return res.status(404).json({
          success: false,
          message: "Segmento no encontrado",
        });
      }

      res.json({
        success: true,
        data: { segment },
      });
    } catch (error) {
      console.error("Error getting segment:", error);
      res.status(500).json({
        success: false,
        message: "Error al obtener segmento",
      });
    }
  }

  /**
   * PUT /api/v2/segments/:id
   * Update segment
   */
  async update(req, res) {
    try {
      const { id } = req.params;
      const businessId = req.businessId;

      const segment = await segmentPersistenceUseCase.update(
        id,
        businessId,
        req.body,
        req.user,
      );

      if (!segment) {
        return res.status(404).json({
          success: false,
          message: "Segmento no encontrado",
        });
      }

      res.json({
        success: true,
        data: { segment },
        message: "Segmento actualizado correctamente",
      });
    } catch (error) {
      console.error("Error updating segment:", error);
      res.status(500).json({
        success: false,
        message: "Error al actualizar segmento",
      });
    }
  }

  /**
   * DELETE /api/v2/segments/:id
   * Delete segment
   */
  async delete(req, res) {
    try {
      const { id } = req.params;
      const businessId = req.businessId;

      const deleted = await segmentPersistenceUseCase.delete(id, businessId, req.user);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: "Segmento no encontrado",
        });
      }

      res.json({
        success: true,
        message: "Segmento eliminado correctamente",
      });
    } catch (error) {
      console.error("Error deleting segment:", error);
      res.status(500).json({
        success: false,
        message: "Error al eliminar segmento",
      });
    }
  }
}

export default new SegmentController();
