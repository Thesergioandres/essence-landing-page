import { AuthService } from "../../domain/services/AuthService.js";
import { jwtTokenService } from "../../infrastructure/services/jwtToken.service.js";
import { UserPersistenceUseCase } from "./repository-gateways/UserPersistenceUseCase.js";

export class RegisterUserUseCase {
  constructor() {
    this.userRepository = new UserPersistenceUseCase();
  }

  async execute(userData) {
    const { name, email, password, businessId, phone, address } = userData;

    if (!name || !email || !password) {
      throw new Error("Missing required fields: name, email, password");
    }

    // 1. Check if user exists
    const userExists = await this.userRepository.findByEmail(email);
    if (userExists) {
      throw new Error("User already exists");
    }

    // 2. Hash Password (Domain Service)
    const hashedPassword = await AuthService.hashPassword(password);

    // 3. Count documents in User collection (Rule 1 & 2)
    const userCount = await this.userRepository.count();
    const isFirstUser = userCount === 0;

    const assignedRole = isFirstUser ? "god" : "super_admin";
    const assignedStatus = isFirstUser ? "active" : "pending";

    // 4. Create User (Identity)
    // We assume Business check happens in Controller or Request Validation
    const newUser = await this.userRepository.createUser({
      name,
      email,
      password: hashedPassword, // Store hash!
      role: assignedRole,
      status: assignedStatus,
      active: assignedStatus === "active",
      subscriptionExpiresAt: null,
      pausedRemainingMs: 0,
      business: businessId,
      phone: phone || undefined,
      address: address || undefined,
      // Other defaults handled by Mongoose Schema or added here
    });

    const repairedBootstrapUser =
      await this.userRepository.promoteToGodIfBootstrap(newUser._id);

    const effectiveUser = repairedBootstrapUser
      ? {
          ...newUser,
          ...repairedBootstrapUser,
        }
      : newUser;

    const effectiveRole = effectiveUser.role;
    const effectiveStatus =
      effectiveRole === "god" ? "active" : effectiveUser.status;
    const effectiveActive =
      effectiveRole === "god" ? true : Boolean(effectiveUser.active);
    const effectiveSubscriptionExpiresAt =
      effectiveRole === "god" ? null : effectiveUser.subscriptionExpiresAt;

    // 4. Generate Token (Auto-login after register?)
    const token = jwtTokenService.generateAccessToken(
      effectiveUser._id,
      effectiveRole,
      effectiveUser.business,
    );
    const refreshToken = jwtTokenService.generateRefreshToken(
      effectiveUser._id,
      effectiveRole,
      effectiveUser.business,
    );

    return {
      _id: effectiveUser._id,
      name: effectiveUser.name,
      email: effectiveUser.email,
      role: effectiveRole,
      isFirstUser,
      status: effectiveStatus,
      active: effectiveActive,
      subscriptionExpiresAt: effectiveSubscriptionExpiresAt,
      business: effectiveUser.business,
      token,
      refreshToken,
      refreshExpiresAt: jwtTokenService.getTokenExpirationIso(refreshToken),
    };
  }
}
