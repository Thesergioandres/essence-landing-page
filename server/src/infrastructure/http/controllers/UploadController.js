/**
 * Upload Controller V2 - HTTP Layer
 * Handles file upload operations (Base64)
 */

class UploadController {
  /**
   * POST /api/v2/upload
   * Upload image (Base64 to MongoDB)
   */
  async uploadImage(req, res) {
    try {
      console.warn("[Essence Debug]", "ðŸ“¤ Upload request received");
      console.warn("[Essence Debug]", "ðŸ“‚ File object:", req.file ? "exists" : "missing");
      console.warn("[Essence Debug]", "ðŸ‘¤ User:", req.user?.id);

      if (!req.file) {
        console.warn("[Essence Debug]", "âŒ No file in request");
        return res.status(400).json({
          success: false,
          message: "No se proporcionÃ³ ninguna imagen",
        });
      }

      // Verify image size (max 5MB for Base64)
      if (req.file.size > 5 * 1024 * 1024) {
        console.warn("[Essence Debug]", "âŒ File too large:", req.file.size);
        return res.status(400).json({
          success: false,
          message: "La imagen es muy grande. MÃ¡ximo 5MB.",
        });
      }

      // Save as Base64 in MongoDB
      console.warn("[Essence Debug]", "ðŸ’¾ Guardando imagen en Base64 (MongoDB)");
      const base64Image = `data:${
        req.file.mimetype
      };base64,${req.file.buffer.toString("base64")}`;

      console.warn("[Essence Debug]", "âœ… Image processed successfully");
      res.json({
        success: true,
        data: {
          url: base64Image,
          publicId: `local_${Date.now()}`,
        },
      });
    } catch (error) {
      console.error("âŒ Error uploading image:", error);
      console.error("Stack:", error.stack);
      res.status(500).json({
        success: false,
        message: "Error al subir la imagen",
        error: error.message,
      });
    }
  }

  /**
   * DELETE /api/v2/upload/:publicId
   * Delete image (Base64 is auto-deleted with product)
   */
  async deleteImage(req, res) {
    try {
      const { publicId } = req.params;

      if (!publicId) {
        return res.status(400).json({
          success: false,
          message: "Se requiere el publicId de la imagen",
        });
      }

      // Base64 images are stored in MongoDB, nothing to delete externally
      console.warn("[Essence Debug]", 
        "ðŸ’¾ Imagen Base64 - se elimina automÃ¡ticamente con el producto",
      );

      res.json({
        success: true,
        message: "Imagen eliminada exitosamente",
      });
    } catch (error) {
      console.error("Error deleting image:", error);
      res.status(500).json({
        success: false,
        message: "Error al eliminar la imagen",
      });
    }
  }
}

export default new UploadController();

