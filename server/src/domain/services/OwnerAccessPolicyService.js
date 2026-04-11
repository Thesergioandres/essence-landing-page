export class OwnerAccessPolicyService {
  static evaluateOwnerAccess(owner) {
    if (!owner) {
      return { hasAccess: true };
    }

    if (owner.role === "god") {
      return { hasAccess: true };
    }

    const ownerExpired =
      owner.subscriptionExpiresAt &&
      new Date(owner.subscriptionExpiresAt).getTime() < Date.now();

    if (owner.status !== "active" || ownerExpired) {
      return {
        hasAccess: false,
        reason: ownerExpired ? "owner_expired" : "owner_inactive",
        ownerStatus: owner.status,
        ownerExpiresAt: owner.subscriptionExpiresAt,
      };
    }

    return { hasAccess: true };
  }
}

export default OwnerAccessPolicyService;
