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
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No se proporcionó ninguna imagen",
        });
      }

      // Verify image size (max 5MB for Base64)
      if (req.file.size > 5 * 1024 * 1024) {
        return res.status(400).json({
          success: false,
          message: "La imagen es muy grande. Máximo 5MB.",
        });
      }

      // Save as Base64 in MongoDB
      console.log("💾 Guardando imagen en Base64 (MongoDB)");
      const base64Image = `data:${
        req.file.mimetype
      };base64,${req.file.buffer.toString("base64")}`;

      res.json({
        success: true,
        data: {
          url: base64Image,
          publicId: `local_${Date.now()}`,
        },
      });
    } catch (error) {
      console.error("Error uploading image:", error);
      res.status(500).json({
        success: false,
        message: "Error al subir la imagen",
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
      console.log(
        "💾 Imagen Base64 - se elimina automáticamente con el producto",
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
