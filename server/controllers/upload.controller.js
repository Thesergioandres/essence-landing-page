// @desc    Subir imagen (Base64 a MongoDB)
// @route   POST /api/upload
// @access  Private/Admin
export const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ message: "No se proporcionó ninguna imagen" });
    }

    // Verificar tamaño de imagen (máximo 5MB para Base64)
    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(400).json({
        message: "La imagen es muy grande. Máximo 5MB.",
      });
    }

    // Guardar como Base64 en MongoDB
    console.log("💾 Guardando imagen en Base64 (MongoDB)");
    const base64Image = `data:${
      req.file.mimetype
    };base64,${req.file.buffer.toString("base64")}`;

    return res.json({
      url: base64Image,
      publicId: `local_${Date.now()}`,
    });
  } catch (error) {
    console.error("Error subiendo imagen:", error);
    res
      .status(500)
      .json({ message: "Error al subir la imagen", error: error.message });
  }
};

// @desc    Eliminar imagen (Base64 se elimina automáticamente con el producto)
// @route   DELETE /api/upload/:publicId
// @access  Private/Admin
export const deleteImage = async (req, res) => {
  try {
    const { publicId } = req.params;

    if (!publicId) {
      return res
        .status(400)
        .json({ message: "Se requiere el publicId de la imagen" });
    }

    // Las imágenes Base64 se guardan en MongoDB, no hay nada que eliminar externamente
    console.log("💾 Imagen Base64 - se elimina automáticamente con el producto");
    res.json({ message: "Imagen eliminada exitosamente" });
  } catch (error) {
    console.error("Error eliminando imagen:", error);
    res
      .status(500)
      .json({ message: "Error al eliminar la imagen", error: error.message });
  }
};
