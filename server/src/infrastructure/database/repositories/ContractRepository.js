import mongoose from "mongoose";
import Contract from "../models/Contract.js";
import Membership from "../models/Membership.js";

const ADMIN_ROLES = new Set(["admin", "super_admin", "god"]);
const TRANSACTION_UNSUPPORTED_PATTERNS = [
  "Transaction numbers are only allowed",
  "Transaction is not supported",
  "replica set member",
  "not a mongos",
];

const sanitizeString = (value) => String(value || "").trim();

const buildScope = (businessId, requesterRole) => {
  if (requesterRole === "god") {
    return {};
  }

  return { business: businessId };
};

const isTransactionUnsupportedError = (error) => {
  const message = String(error?.message || "");
  return TRANSACTION_UNSUPPORTED_PATTERNS.some((pattern) =>
    message.includes(pattern),
  );
};

class ContractRepository {
  async assertMemberInBusiness(
    userId,
    businessId,
    requesterRole,
    session = null,
  ) {
    if (requesterRole === "god") {
      return;
    }

    const membership = await Membership.findOne({
      business: businessId,
      user: userId,
      status: "active",
    }).session(session);

    if (!membership) {
      const error = new Error("El firmante no pertenece a este negocio");
      error.statusCode = 404;
      throw error;
    }
  }

  async list({ businessId, requesterRole, requesterId, signedBy = null }) {
    const filter = {
      ...buildScope(businessId, requesterRole),
    };

    if (!ADMIN_ROLES.has(requesterRole)) {
      filter.signedBy = requesterId;
    } else if (signedBy) {
      filter.signedBy = signedBy;
    }

    return Contract.find(filter)
      .populate("signedBy", "name email")
      .sort({ signedAt: -1, createdAt: -1 })
      .lean();
  }

  async findById({ contractId, businessId, requesterRole, requesterId }) {
    const contract = await Contract.findOne({
      _id: contractId,
      ...buildScope(businessId, requesterRole),
    })
      .populate("signedBy", "name email")
      .lean();

    if (!contract) {
      const error = new Error("Contrato no encontrado");
      error.statusCode = 404;
      throw error;
    }

    if (
      !ADMIN_ROLES.has(requesterRole) &&
      String(contract.signedBy?._id || contract.signedBy || "") !==
        String(requesterId || "")
    ) {
      const error = new Error("No tienes acceso a este contrato");
      error.statusCode = 403;
      throw error;
    }

    return contract;
  }

  async createSignedContract({
    businessId,
    requesterRole,
    requesterId,
    title,
    content,
    signatureData,
    photoData,
    signedBy,
  }) {
    const normalizedTitle = sanitizeString(title);
    const normalizedContent = sanitizeString(content);
    const normalizedSignatureData = sanitizeString(signatureData);
    const normalizedPhotoData = sanitizeString(photoData);
    const normalizedSignedBy = sanitizeString(signedBy || requesterId);

    if (!normalizedTitle) {
      const error = new Error("El titulo es obligatorio");
      error.statusCode = 400;
      throw error;
    }

    if (!normalizedContent) {
      const error = new Error("El contenido es obligatorio");
      error.statusCode = 400;
      throw error;
    }

    if (!normalizedSignatureData) {
      const error = new Error("La firma digital es obligatoria");
      error.statusCode = 400;
      throw error;
    }

    if (!normalizedPhotoData) {
      const error = new Error("La foto del firmante es obligatoria");
      error.statusCode = 400;
      throw error;
    }

    if (!mongoose.isValidObjectId(normalizedSignedBy)) {
      const error = new Error("signedBy invalido");
      error.statusCode = 400;
      throw error;
    }

    if (
      !ADMIN_ROLES.has(requesterRole) &&
      String(normalizedSignedBy) !== String(requesterId)
    ) {
      const error = new Error("Solo puedes firmar contratos propios");
      error.statusCode = 403;
      throw error;
    }

    await this.assertMemberInBusiness(
      normalizedSignedBy,
      businessId,
      requesterRole,
    );

    const payload = {
      business: businessId,
      title: normalizedTitle,
      content: normalizedContent,
      signedBy: normalizedSignedBy,
      signatureData: normalizedSignatureData,
      photoData: normalizedPhotoData,
      signedAt: new Date(),
      isLocked: true,
      createdBy: requesterId,
      updatedBy: requesterId,
    };

    const writeContract = async (session = null) => {
      const options = session ? { session } : undefined;
      const [contract] = await Contract.create([payload], options);
      return contract;
    };

    let createdContract = null;
    const session = await mongoose.startSession();

    try {
      session.startTransaction();
      createdContract = await writeContract(session);
      await session.commitTransaction();
    } catch (error) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }

      if (isTransactionUnsupportedError(error)) {
        createdContract = await writeContract();
      } else {
        throw error;
      }
    } finally {
      session.endSession();
    }

    return this.findById({
      contractId: createdContract._id,
      businessId,
      requesterRole: "god",
      requesterId,
    });
  }

  async updateById({
    contractId,
    businessId,
    requesterRole,
    requesterId,
    data,
  }) {
    if (!ADMIN_ROLES.has(requesterRole)) {
      const error = new Error("Solo administradores pueden editar contratos");
      error.statusCode = 403;
      throw error;
    }

    const contract = await Contract.findOne({
      _id: contractId,
      ...buildScope(businessId, requesterRole),
    });

    if (!contract) {
      const error = new Error("Contrato no encontrado");
      error.statusCode = 404;
      throw error;
    }

    if (data.title !== undefined) {
      const title = sanitizeString(data.title);
      if (!title) {
        const error = new Error("El titulo no puede estar vacio");
        error.statusCode = 400;
        throw error;
      }
      contract.title = title;
    }

    if (data.content !== undefined) {
      const content = sanitizeString(data.content);
      if (!content) {
        const error = new Error("El contenido no puede estar vacio");
        error.statusCode = 400;
        throw error;
      }
      contract.content = content;
    }

    if (data.signatureData !== undefined) {
      const signatureData = sanitizeString(data.signatureData);
      if (!signatureData) {
        const error = new Error("La firma digital no puede estar vacia");
        error.statusCode = 400;
        throw error;
      }
      contract.signatureData = signatureData;
    }

    if (data.photoData !== undefined) {
      const photoData = sanitizeString(data.photoData);
      if (!photoData) {
        const error = new Error("La foto no puede estar vacia");
        error.statusCode = 400;
        throw error;
      }
      contract.photoData = photoData;
    }

    if (data.signedBy !== undefined) {
      const signedBy = sanitizeString(data.signedBy);
      if (!mongoose.isValidObjectId(signedBy)) {
        const error = new Error("signedBy invalido");
        error.statusCode = 400;
        throw error;
      }

      await this.assertMemberInBusiness(signedBy, businessId, requesterRole);
      contract.signedBy = signedBy;
    }

    if (data.signedAt !== undefined) {
      const signedAt = new Date(data.signedAt);
      if (Number.isNaN(signedAt.getTime())) {
        const error = new Error("signedAt invalido");
        error.statusCode = 400;
        throw error;
      }
      contract.signedAt = signedAt;
    }

    contract.updatedBy = requesterId;
    await contract.save();

    return this.findById({
      contractId,
      businessId,
      requesterRole,
      requesterId,
    });
  }

  async deleteById({ contractId, businessId, requesterRole }) {
    if (!ADMIN_ROLES.has(requesterRole)) {
      const error = new Error("Solo administradores pueden eliminar contratos");
      error.statusCode = 403;
      throw error;
    }

    const deleted = await Contract.findOneAndDelete({
      _id: contractId,
      ...buildScope(businessId, requesterRole),
    });

    if (!deleted) {
      const error = new Error("Contrato no encontrado");
      error.statusCode = 404;
      throw error;
    }

    return {
      deletedId: deleted._id,
      message: "Contrato eliminado correctamente",
    };
  }
}

export default new ContractRepository();
