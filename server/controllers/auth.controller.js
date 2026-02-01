import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import RefreshToken from "../models/RefreshToken.js";
import User from "../models/User.js";
import AuditService from "../services/audit.service.js";
import { logApiError, logApiInfo, logAuthError } from "../utils/logger.js";

// Generar Access Token (corta duración)
const generateAccessToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES || "15m",
  });
};

// Generar Refresh Token (larga duración)
const generateRefreshToken = () => {
  return crypto.randomBytes(64).toString("hex");
};

// Guardar refresh token en BD
const saveRefreshToken = async (userId, token, req) => {
  const refreshTokenDays = parseInt(process.env.JWT_REFRESH_DAYS || "7", 10);
  const expiresAt = new Date(
    Date.now() + refreshTokenDays * 24 * 60 * 60 * 1000,
  );

  await RefreshToken.create({
    user: userId,
    token,
    expiresAt,
    createdByIp: req.ip || req.connection?.remoteAddress,
    userAgent: req.headers["user-agent"],
  });

  return { token, expiresAt };
};

// Generar JWT (legacy - mantener compatibilidad)
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

// @desc    Registrar nuevo usuario
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res) => {
  try {
    const { name, email, password, phone, address } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Nombre, email y contraseña son obligatorios",
      });
    }

    // Verificar si el usuario existe
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "El usuario ya existe" });
    }

    // Verificar si es el primer usuario (será GOD)
    const userCount = await User.countDocuments();
    const isFirstUser = userCount === 0;

    // Hash de la contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: isFirstUser ? "god" : "super_admin",
      status: isFirstUser ? "active" : "pending",
      active: isFirstUser ? true : false,
      ...(phone ? { phone } : {}),
      ...(address ? { address } : {}),
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        subscriptionExpiresAt: user.subscriptionExpiresAt,
        phone: user.phone,
        address: user.address,
        token: generateToken(user._id),
      });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Autenticar usuario
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res) => {
  const requestId = req.reqId;
  try {
    const { email, password } = req.body;

    // Buscar usuario
    const user = await User.findOne({ email });

    if (user && (await bcrypt.compare(password, user.password))) {
      // Log de login exitoso
      await AuditService.logAuth(user, "login", req, true);

      // Generar tokens
      const accessToken = generateAccessToken(user._id);
      const refreshTokenValue = generateRefreshToken();
      const refreshData = await saveRefreshToken(
        user._id,
        refreshTokenValue,
        req,
      );

      logApiInfo({
        message: "login_success",
        module: "auth",
        requestId,
        userId: user._id.toString(),
      });

      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        subscriptionExpiresAt: user.subscriptionExpiresAt,
        token: accessToken,
        refreshToken: refreshTokenValue,
        refreshExpiresAt: refreshData.expiresAt,
        requestId,
      });
    } else {
      // Log de login fallido
      await AuditService.logAuth(null, "login", req, false);

      logAuthError({
        message: "login_failed",
        module: "auth",
        requestId,
        extra: { email },
      });

      res.status(401).json({ message: "Credenciales inválidas", requestId });
    }
  } catch (error) {
    logApiError({
      message: "login_error",
      module: "auth",
      requestId,
      stack: error.stack,
    });
    res.status(500).json({ message: error.message, requestId });
  }
};

// @desc    Obtener perfil del usuario
// @route   GET /api/auth/profile
// @access  Private
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtener todos los usuarios (admin)
// @route   GET /api/users
// @access  Private/Admin
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({})
      .select("-password")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Crear administrador por única vez
// @route   POST /api/auth/create-admin
// @access  Public (solo si no existe un admin)
export const createAdmin = async (req, res) => {
  try {
    const { password, name } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({
        message: "La contraseña debe tener al menos 6 caracteres",
      });
    }

    // Verificar si ya existe un administrador o el correo definido
    const existingAdmin = await User.findOne({ role: "admin" });
    const existingEmail = await User.findOne({
      email: "serguito2003@gmail.com",
    });

    if (existingAdmin || existingEmail) {
      return res.status(400).json({
        message: "El usuario administrador ya fue creado previamente",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const adminUser = await User.create({
      name: name?.trim() || "Administrador",
      email: "serguito2003@gmail.com",
      password: hashedPassword,
      role: "admin",
    });

    res.status(201).json({
      _id: adminUser._id,
      name: adminUser.name,
      email: adminUser.email,
      role: adminUser.role,
      token: generateToken(adminUser._id),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Refrescar access token usando refresh token
// @route   POST /api/auth/refresh
// @access  Public
export const refreshAccessToken = async (req, res) => {
  const requestId = req.reqId;
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      logAuthError({
        message: "refresh_failed_no_token",
        module: "auth",
        requestId,
      });
      return res.status(400).json({
        message: "Refresh token es requerido",
        requestId,
      });
    }

    // Buscar el refresh token en la BD
    const storedToken = await RefreshToken.findOne({ token: refreshToken });

    if (!storedToken) {
      logAuthError({
        message: "refresh_failed_invalid_token",
        module: "auth",
        requestId,
      });
      return res.status(401).json({
        message: "Refresh token inválido",
        code: "INVALID_REFRESH_TOKEN",
        requestId,
      });
    }

    // Verificar si está revocado
    if (storedToken.revokedAt) {
      logAuthError({
        message: "refresh_failed_revoked",
        module: "auth",
        requestId,
        userId: storedToken.user?.toString(),
      });
      return res.status(401).json({
        message: "Refresh token ha sido revocado",
        code: "REVOKED_REFRESH_TOKEN",
        requestId,
      });
    }

    // Verificar si expiró
    if (storedToken.expiresAt < new Date()) {
      logAuthError({
        message: "refresh_failed_expired",
        module: "auth",
        requestId,
        userId: storedToken.user?.toString(),
      });
      return res.status(401).json({
        message: "Refresh token expirado",
        code: "EXPIRED_REFRESH_TOKEN",
        requestId,
      });
    }

    // Obtener usuario
    const user = await User.findById(storedToken.user).select("-password");
    if (!user) {
      logAuthError({
        message: "refresh_failed_user_not_found",
        module: "auth",
        requestId,
      });
      return res.status(401).json({
        message: "Usuario no encontrado",
        requestId,
      });
    }

    // Revocar token actual (rotación)
    storedToken.revokedAt = new Date();
    storedToken.revokedByIp = req.ip || req.connection?.remoteAddress;

    // Generar nuevos tokens
    const newAccessToken = generateAccessToken(user._id);
    const newRefreshTokenValue = generateRefreshToken();
    storedToken.replacedByToken = newRefreshTokenValue;
    await storedToken.save();

    // Guardar nuevo refresh token
    const newRefreshData = await saveRefreshToken(
      user._id,
      newRefreshTokenValue,
      req,
    );

    logApiInfo({
      message: "refresh_success",
      module: "auth",
      requestId,
      userId: user._id.toString(),
    });

    res.json({
      token: newAccessToken,
      refreshToken: newRefreshTokenValue,
      refreshExpiresAt: newRefreshData.expiresAt,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      },
      requestId,
    });
  } catch (error) {
    logApiError({
      message: "refresh_error",
      module: "auth",
      requestId,
      stack: error.stack,
    });
    res.status(500).json({ message: error.message, requestId });
  }
};

// @desc    Logout - revocar refresh token
// @route   POST /api/auth/logout
// @access  Private
export const logout = async (req, res) => {
  const requestId = req.reqId;
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      // Revocar el refresh token específico
      await RefreshToken.findOneAndUpdate(
        { token: refreshToken },
        {
          revokedAt: new Date(),
          revokedByIp: req.ip || req.connection?.remoteAddress,
        },
      );
    }

    // Opcionalmente revocar todos los tokens del usuario
    if (req.body.revokeAll && req.user?.id) {
      await RefreshToken.revokeAllForUser(
        req.user.id,
        req.ip || req.connection?.remoteAddress,
      );
    }

    logApiInfo({
      message: "logout_success",
      module: "auth",
      requestId,
      userId: req.user?.id,
    });

    res.json({ message: "Sesión cerrada correctamente", requestId });
  } catch (error) {
    logApiError({
      message: "logout_error",
      module: "auth",
      requestId,
      stack: error.stack,
    });
    res.status(500).json({ message: error.message, requestId });
  }
};
