import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import AuditService from "../services/audit.service.js";

// Generar JWT
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
    const { name, email, password } = req.body;

    // Verificar si el usuario existe
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "El usuario ya existe" });
    }

    // Hash de la contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Crear usuario
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
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
  try {
    const { email, password } = req.body;

    // Buscar usuario
    const user = await User.findOne({ email });

    if (user && (await bcrypt.compare(password, user.password))) {
      // Log de login exitoso
      await AuditService.logAuth(user, "login", req, true);

      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user._id),
      });
    } else {
      // Log de login fallido
      await AuditService.logAuth(null, "login", req, false);

      res.status(401).json({ message: "Credenciales inválidas" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
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
    const existingEmail = await User.findOne({ email: "serguito2003@gmail.com" });

    if (existingAdmin || existingEmail) {
      return res
        .status(400)
        .json({ message: "El usuario administrador ya fue creado previamente" });
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
