import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export class AuthService {
  /**
   * Compare candidate password with hashed password
   * @param {string} candidatePassword
   * @param {string} hashedPassword
   * @returns {Promise<boolean>}
   */
  static async validatePassword(candidatePassword, hashedPassword) {
    return await bcrypt.compare(candidatePassword, hashedPassword);
  }

  /**
   * Generate JWT Token
   * @param {string} userId
   * @param {string} role
   * @param {string} businessId
   * @returns {string} token
   */
  static generateToken(userId, role, businessId) {
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not defined");
    }

    return jwt.sign({ id: userId, role, businessId }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE || "30d",
    });
  }

  /**
   * Hash password
   * @param {string} password
   * @returns {Promise<string>}
   */
  static async hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
  }
}
