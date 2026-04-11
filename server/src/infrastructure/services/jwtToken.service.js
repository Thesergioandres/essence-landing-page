import jwt from "jsonwebtoken";

const resolveAccessSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined");
  }
  return process.env.JWT_SECRET;
};

const resolveRefreshSecret = () => {
  const refreshSecret =
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || null;
  if (!refreshSecret) {
    throw new Error("JWT_SECRET is not defined");
  }
  return refreshSecret;
};

export const jwtTokenService = {
  generateAccessToken(userId, role, businessId) {
    return jwt.sign({ id: userId, role, businessId }, resolveAccessSecret(), {
      expiresIn: process.env.JWT_EXPIRE || "30d",
    });
  },

  generateRefreshToken(userId, role, businessId = null) {
    return jwt.sign(
      { id: userId, role, businessId, type: "refresh" },
      resolveRefreshSecret(),
      {
        expiresIn: process.env.JWT_REFRESH_EXPIRE || "60d",
      },
    );
  },

  verifyRefreshToken(token) {
    return jwt.verify(token, resolveRefreshSecret());
  },

  verifyAccessToken(token) {
    return jwt.verify(token, resolveAccessSecret());
  },

  getTokenExpirationIso(token) {
    const decoded = jwt.decode(token);
    if (!decoded || typeof decoded !== "object" || !decoded.exp) {
      return null;
    }

    return new Date(Number(decoded.exp) * 1000).toISOString();
  },
};
