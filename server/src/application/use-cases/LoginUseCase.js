import { AuthService } from "../../domain/services/AuthService.js";
import { jwtTokenService } from "../../infrastructure/services/jwtToken.service.js";
import { UserPersistenceUseCase } from "./repository-gateways/UserPersistenceUseCase.js";

export class LoginUseCase {
  constructor() {
    this.userRepository = new UserPersistenceUseCase();
  }

  async execute(email, password) {
    if (!email || !password) {
      throw new Error("Please provide an email and password");
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const rawPassword = String(password);

    // 1. Find User (Need password for check + memberships)
    const user =
      await this.userRepository.findByEmailWithMethods(normalizedEmail);

    if (!user) {
      throw new Error("Invalid credentials");
    }

    // 2. Validate Password
    const isMatch = await AuthService.validatePassword(
      rawPassword,
      user.password,
    );

    if (!isMatch) {
      const storedPassword = String(user.password || "");
      const isLegacyPlaintext = !storedPassword.startsWith("$2");

      if (!isLegacyPlaintext || storedPassword !== rawPassword) {
        throw new Error("Invalid credentials");
      }

      user.password = await AuthService.hashPassword(rawPassword);
      await user.save();
      console.warn(
        `[AUTH] Password legacy migrada a bcrypt para ${normalizedEmail}`,
      );
    }

    // Bootstrap repair:
    // si no existe GOD y este usuario es el primero de la coleccion,
    // se promueve automaticamente para evitar bloqueo inicial de onboarding.
    const repairedBootstrapUser =
      await this.userRepository.promoteToGodIfBootstrap(user._id);

    if (repairedBootstrapUser) {
      user.role = repairedBootstrapUser.role || user.role;
      user.status = repairedBootstrapUser.status || user.status;
      user.active =
        repairedBootstrapUser.active === undefined
          ? user.active
          : repairedBootstrapUser.active;
      user.subscriptionExpiresAt =
        repairedBootstrapUser.subscriptionExpiresAt === undefined
          ? user.subscriptionExpiresAt
          : repairedBootstrapUser.subscriptionExpiresAt;
    }

    // 3. Get first active business from memberships (for token)
    const memberships = user._doc?.memberships || user.memberships || [];
    const primaryMembership = memberships[0];
    const businessId = primaryMembership?.business?._id || null;
    const isGod = user.role === "god";

    // 4. Generate Token
    const token = jwtTokenService.generateAccessToken(
      user._id,
      user.role,
      businessId,
    );
    const refreshToken = jwtTokenService.generateRefreshToken(
      user._id,
      user.role,
      businessId,
    );

    // 5. Return result with memberships for frontend
    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: isGod ? "active" : user.status,
      active: isGod ? true : user.active,
      subscriptionExpiresAt: isGod ? null : user.subscriptionExpiresAt,
      memberships, // 🔑 Frontend needs this to know user has businesses
      token,
      refreshToken,
      refreshExpiresAt: jwtTokenService.getTokenExpirationIso(refreshToken),
    };
  }
}
