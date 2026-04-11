import { AuthService } from "../../domain/services/AuthService.js";
import { jwtTokenService } from "../../infrastructure/services/jwtToken.service.js";
import { UserPersistenceUseCase } from "./repository-gateways/UserPersistenceUseCase.js";

export class RegisterUserUseCase {
  constructor() {
    this.userRepository = new UserPersistenceUseCase();
  }

  async execute(userData) {
    const { name, email, password, role, businessId, phone, address } =
      userData;

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

    // 3. Create User (Identity)
    // We assume Business check happens in Controller or Request Validation
    const newUser = await this.userRepository.createUser({
      name,
      email,
      password: hashedPassword, // Store hash!
      role: role || "super_admin", // Default role for new registrations
      status: "pending",
      active: false,
      subscriptionExpiresAt: null,
      pausedRemainingMs: 0,
      business: businessId,
      phone: phone || undefined,
      address: address || undefined,
      // Other defaults handled by Mongoose Schema or added here
    });

    // 4. Generate Token (Auto-login after register?)
    const token = jwtTokenService.generateAccessToken(
      newUser._id,
      newUser.role,
      newUser.business,
    );
    const refreshToken = jwtTokenService.generateRefreshToken(
      newUser._id,
      newUser.role,
      newUser.business,
    );

    return {
      _id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      status: newUser.status,
      active: newUser.active,
      subscriptionExpiresAt: newUser.subscriptionExpiresAt,
      business: newUser.business,
      token,
      refreshToken,
      refreshExpiresAt: jwtTokenService.getTokenExpirationIso(refreshToken),
    };
  }
}
