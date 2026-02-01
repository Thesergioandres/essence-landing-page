import Provider from "../models/Provider.js";

const resolveBusinessId = (req) =>
  req.businessId || req.headers["x-business-id"] || req.query.businessId;

export const createProvider = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const provider = await Provider.create({
      ...req.body,
      business: businessId,
    });

    res.status(201).json({ provider });
  } catch (error) {
    const status = error.code === 11000 ? 409 : 500;
    res.status(status).json({ message: error.message });
  }
};

export const listProviders = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const providers = await Provider.find({ business: businessId })
      .sort({ name: 1 })
      .lean();
    res.json({ providers });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getProvider = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    const provider = await Provider.findOne({
      _id: req.params.id,
      business: businessId,
    }).lean();

    if (!provider) {
      return res.status(404).json({ message: "Proveedor no encontrado" });
    }

    res.json({ provider });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateProvider = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    const provider = await Provider.findOneAndUpdate(
      { _id: req.params.id, business: businessId },
      req.body,
      { new: true },
    );

    if (!provider) {
      return res.status(404).json({ message: "Proveedor no encontrado" });
    }

    res.json({ provider });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteProvider = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    const provider = await Provider.findOneAndDelete({
      _id: req.params.id,
      business: businessId,
    });

    if (!provider) {
      return res.status(404).json({ message: "Proveedor no encontrado" });
    }

    res.json({ message: "Proveedor eliminado" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
