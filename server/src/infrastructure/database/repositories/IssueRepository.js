import IssueReport from "../../../../models/IssueReport.js";

const MAX_LOG_BYTES = 5 * 1024 * 1024;

export class IssueRepository {
  sanitizeLogs(logsInput) {
    if (!logsInput) return [];
    if (Array.isArray(logsInput)) {
      return logsInput
        .map((item) =>
          typeof item === "string" ? item : JSON.stringify(item, null, 2),
        )
        .filter(Boolean);
    }
    if (typeof logsInput === "string") return [logsInput];
    return [];
  }

  async create(data, userId, userRole) {
    const logs = this.sanitizeLogs(data.logs);
    const totalBytes = Buffer.byteLength(logs.join("\n"), "utf8");

    if (totalBytes > MAX_LOG_BYTES) {
      const err = new Error("El tamaño de los logs excede 5MB");
      err.statusCode = 413;
      throw err;
    }

    const report = await IssueReport.create({
      user: userId,
      role: userRole,
      message: data.message.trim(),
      stackTrace:
        typeof data.stackTrace === "string" ? data.stackTrace : undefined,
      logs,
      clientContext: {
        url: data.clientContext?.url,
        userAgent: data.clientContext?.userAgent,
        appVersion: data.clientContext?.appVersion,
        businessId: data.clientContext?.businessId,
      },
      screenshotUrl: data.screenshotUrl,
      screenshotPublicId: data.screenshotPublicId,
    });

    return report;
  }

  async findAll(filters = {}) {
    const query = {};

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.userId) {
      query.user = filters.userId;
    }

    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 20;
    const skip = (page - 1) * limit;

    const [reports, total] = await Promise.all([
      IssueReport.find(query)
        .populate("user", "name email role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      IssueReport.countDocuments(query),
    ]);

    return {
      reports,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id) {
    const report = await IssueReport.findById(id)
      .populate("user", "name email role")
      .lean();
    return report;
  }

  async updateStatus(id, status) {
    const report = await IssueReport.findByIdAndUpdate(
      id,
      { status },
      { new: true },
    );

    if (!report) {
      const err = new Error("Reporte no encontrado");
      err.statusCode = 404;
      throw err;
    }

    return report;
  }
}
