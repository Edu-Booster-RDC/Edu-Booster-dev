const HttpError = require("../models/error");
const { PrismaClient } = require("../generated/prisma");
const bcrypt = require("bcryptjs");
const { sendCode, sendResetCOde } = require("../emails/sendMail");
const {
  generateAccessToken,
  generateRefreshToken,
} = require("../utils/generateTokens");
const { sendOtp, sendSMSResetCode } = require("../emails/sms");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const db = new PrismaClient();

function validatePassword(password) {
  const minLength = 8;
  const commonPasswords = ["123456", "password", "123456789", "qwerty"];

  if (typeof password !== "string") {
    throw new Error("Le mot de passe doit être une chaîne de caractères.");
  }
  if (password.length < minLength) {
    throw new Error(
      `Le mot de passe doit contenir au moins ${minLength} caractères.`
    );
  }
  if (commonPasswords.includes(password.toLowerCase())) {
    throw new Error("Ce mot de passe est trop commun.");
  }
  if (!/[A-Z]/.test(password)) {
    throw new Error(
      "Le mot de passe doit contenir au moins une lettre majuscule."
    );
  }
  if (!/[a-z]/.test(password)) {
    throw new Error(
      "Le mot de passe doit contenir au moins une lettre minuscule."
    );
  }
  if (!/[0-9]/.test(password)) {
    throw new Error("Le mot de passe doit contenir au moins un chiffre.");
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    throw new Error(
      "Le mot de passe doit contenir au moins un caractère spécial."
    );
  }

  return true;
}
const isEmail = (value) => /\S+@\S+\.\S+/.test(value);

const createUser = async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, password2, role } = req.body;

    if (!firstName || !lastName || !email || !password || !role) {
      return next(new HttpError("Veuillez remplir tous les champs.", 400));
    }

    const newEmail = email.toLowerCase();
    const existingUser = await db.user.findUnique({
      where: { email: newEmail },
    });

    if (existingUser) {
      return next(new HttpError("Cet e-mail est déjà utilisé.", 400));
    }

    if (password !== password2) {
      return next(
        new HttpError("Les mots de passe ne correspondent pas.", 400)
      );
    }

    try {
      validatePassword(password);
    } catch (err) {
      return next(new HttpError(err.message, 400));
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPass = await bcrypt.hash(password, salt);

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiration = new Date(Date.now() + 10 * 60 * 1000);

    const user = await db.user.create({
      data: {
        email: newEmail,
        firstName,
        lastName,
        password: hashedPass,
        verificationCode: code,
        codeExpiration: expiration,
        role,
      },
    });

    // Envoi par mail et SMS
    await sendCode(user.email, code, user.firstName, user.lastName);

    const {
      password: _,
      verificationCode,
      codeExpiration,
      phoneVerificationCode,
      phoneCodeExpiration,
      ...safeUser
    } = user;

    res.status(201).json({
      success: true,
      user: safeUser,
      message: `Un code de vérification a été envoyé à ${user.email}.`,
    });
  } catch (error) {
    console.error(error);
    return next(
      new HttpError(error.message || "Une erreur est survenue.", 500)
    );
  }
};

const verifyEmail = async (req, res, next) => {
  try {
    const { code } = req.body;
    if (!code) {
      return next(new HttpError("Le code est requis.", 400));
    }

    const user = await db.user.findFirst({ where: { verificationCode: code } });
    if (!user) {
      return next(new HttpError("Code de vérification invalide.", 404));
    }

    if (user.isVerified) {
      return next(new HttpError("Ce compte est déjà vérifié.", 400));
    }

    if (user.codeExpiration < new Date()) {
      return res.status(400).json({
        error: "expired",
        email: user.email,
        message: "Le code a expiré, veuillez en demander un nouveau.",
      });
    }

    await db.user.update({
      where: { id: user.id },
      data: { isVerified: true, verificationCode: null, codeExpiration: null },
    });

    return res.status(200).json({ message: "Compte vérifié avec succès." });
  } catch (error) {
    console.error(error);
    return next(
      new HttpError(error.message || "Une erreur est survenue.", 500)
    );
  }
};

const newCode = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return next(new HttpError("Veuillez fournir un email.", 400));
    }

    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (!user) {
      return next(new HttpError("Utilisateur introuvable.", 404));
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiration = new Date(Date.now() + 15 * 60 * 1000);

    await db.user.update({
      where: { id: user.id },
      data: { verificationCode: code, codeExpiration: expiration },
    });

    await sendCode(user.email, code, user.firstName, user.lastName);

    const {
      password: _,
      verificationCode,
      codeExpiration,
      phoneVerificationCode,
      phoneCodeExpiration,
      ...safeUser
    } = user;

    res.status(201).json({
      success: true,
      user: safeUser,
      message: `Un nouveau code de vérification a été envoyé à ${user.email}.`,
    });
  } catch (error) {
    console.error(error);
    return next(
      new HttpError(error.message || "Une erreur est survenue.", 500)
    );
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return next(new HttpError("Veuillez remplir tous les champs.", 400));
    }

    const user = await db.user.findFirst({
      where: { email: email.toLowerCase() },
    });
    if (!user) {
      return next(new HttpError("Utilisateur introuvable.", 404));
    }

    if (!user.isVerified) {
      return res.status(403).json({
        error: "unverified",
        email: user.email,
        message: "Veuillez vérifier votre compte avant de vous connecter.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return next(new HttpError("Mot de passe incorrect.", 401));
    }

    const accessToken = generateAccessToken(user.id, user.role);
    const refreshToken = generateRefreshToken(user.id);

    await db.user.update({
      where: { id: user.id },
      data: { refreshToken, lastLogin: new Date() },
    });

    const {
      password: _,
      verificationCode,
      codeExpiration,
      phoneVerificationCode,
      phoneCodeExpiration,
      ...safeUser
    } = user;

    res.status(200).json({
      success: true,
      user: safeUser,
      accessToken,
      refreshToken,
      message: "Connexion réussie.",
    });
  } catch (error) {
    console.error(error);
    return next(
      new HttpError(error.message || "Une erreur est survenue.", 500)
    );
  }
};

const refreshToken = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) {
      return next(new HttpError("Aucun refresh token fourni.", 401));
    }

    // Vérifier que le token existe en DB
    const user = await db.user.findFirst({ where: { refreshToken: token } });
    if (!user) {
      return next(new HttpError("Refresh token invalide.", 403));
    }

    jwt.verify(token, process.env.JWT_REFRESH_SECRET, async (err, decoded) => {
      if (err || decoded.id !== user.id) {
        return next(new HttpError("Refresh token expiré ou invalide.", 403));
      }

      const accessToken = generateAccessToken(user.id, user.role);
      const newRefreshToken = generateRefreshToken(user.id);

      await db.user.update({
        where: { id: user.id },
        data: { refreshToken: newRefreshToken },
      });

      res.status(200).json({
        success: true,
        accessToken,
        refreshToken: newRefreshToken,
        message: "Token rafraîchi avec succès.",
      });
    });
  } catch (error) {
    console.error(error);
    return next(
      new HttpError(error.message || "Une erreur est survenue.", 500)
    );
  }
};

const logout = async (req, res, next) => {
  try {
    const userId = req.user.id;
    if (!userId) {
      return next(new HttpError("L'identifiant utilisateur est requis.", 400));
    }

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      return next(new HttpError("Utilisateur introuvable.", 404));
    }

    await db.user.update({
      where: { id: user.id },
      data: { refreshToken: null },
    });

    res.status(200).json({
      success: true,
      message: "Déconnexion réussie. Le refresh token a été supprimé.",
    });
  } catch (error) {
    console.error(error);
    return next(
      new HttpError(error.message || "Une erreur est survenue.", 500)
    );
  }
};

const addPhoneNumber = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return next(
        new HttpError("Veuillez saisir un numéro de téléphone.", 400)
      );
    }

    if (!userId) {
      return next(new HttpError("Utilisateur invalide.", 401));
    }

    const user = await db.user.findUnique({ where: { id: userId } });

    if (!user) {
      return next(new HttpError("Utilisateur introuvable.", 404));
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiration = new Date(Date.now() + 10 * 60 * 1000);

    const updatedUser = await db.user.update({
      where: { id: userId },
      data: {
        phone: phoneNumber,
        phoneVerificationCode: code,
        phoneCodeExpiration: expiration,
      },
    });

    await sendOtp(updatedUser.phone, updatedUser.phoneVerificationCode);

    const message = user.phone
      ? "Votre numéro de téléphone a été mis à jour avec succès."
      : "Votre numéro de téléphone a été ajouté avec succès.";

    return res.status(200).json({
      success: true,
      message,
      phone: updatedUser.phone,
    });
  } catch (error) {
    console.error("Erreur lors de l’ajout du numéro de téléphone:", error);
    return next(
      new HttpError(
        error.message ||
          "Une erreur interne est survenue. Veuillez réessayer plus tard.",
        500
      )
    );
  }
};

const verifyPhone = async (req, res, next) => {
  try {
    const { code } = req.body;

    if (!code) {
      return next(new HttpError("Le code est requis.", 400));
    }

    const user = await db.user.findFirst({
      where: { phoneVerificationCode: code },
    });

    if (!user) {
      return next(new HttpError("Code ou numéro de téléphone invalide.", 404));
    }

    if (user.phoneCodeExpiration < new Date()) {
      return res.status(400).json({
        error: "expired",
        phone: user.phone,
        message: "Le code a expiré, veuillez en demander un nouveau.",
      });
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        phoneVerificationCode: null,
        phoneCodeExpiration: null,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Numéro de téléphone vérifié avec succès.",
    });
  } catch (error) {
    console.error(error);
    return next(
      new HttpError(error.message || "Une erreur est survenue.", 500)
    );
  }
};

const newPhoneCode = async (req, res, next) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return next(new HttpError("Le numéro de téléphone est requis.", 400));
    }

    const user = await db.user.findFirst({
      where: { phone },
    });

    if (!user) {
      return next(
        new HttpError(
          "Utilisateur introuvable avec ce numéro de téléphone.",
          404
        )
      );
    }

    // Générer un nouveau code OTP (6 chiffres)
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Mettre à jour le user
    await db.user.update({
      where: { id: user.id },
      data: {
        phoneVerificationCode: newCode,
        phoneCodeExpiration: new Date(Date.now() + 10 * 60 * 1000), // 10 min
      },
    });

    await sendOtp(phone, newCode);

    return res.status(200).json({
      success: true,
      message: "Nouveau code envoyé par SMS.",
      phone: user.phone,
    });
  } catch (error) {
    console.error(error);
    return next(
      new HttpError(error.message || "Une erreur est survenue.", 500)
    );
  }
};

const requestPasswordReset = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return next(new HttpError("Email requis.", 400));
    }

    const user = await db.user.findFirst({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return next(new HttpError("Utilisateur introuvable.", 404));
    }

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiration = new Date(Date.now() + 15 * 60 * 1000); // expire dans 15 minutes

    await db.user.update({
      where: { id: user.id },
      data: {
        resetCode: resetCode,
        resetCodeExpiration: expiration,
      },
    });

    await sendResetCOde(user.email, resetCode, user.firstName, user.lastName);

    res.status(200).json({
      success: true,
      message: "Un code de réinitialisation a été envoyé.",
    });
  } catch (error) {
    console.log(error);
    return next(new HttpError("Erreur lors de la demande de reset.", 500));
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { code, email, newPassword } = req.body;

    if (!code || !newPassword || !email) {
      return next(new HttpError("Champs requis manquants.", 400));
    }

    const user = await db.user.findFirst({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return next(new HttpError("Utilisateur introuvable.", 404));
    }

    if (
      !user.resetCode ||
      user.resetCode !== code ||
      user.resetCodeExpiration < new Date()
    ) {
      return next(new HttpError("Code invalide ou expiré.", 400));
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await db.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetCode: null,
        resetCodeExpiration: null,
      },
    });

    res.status(200).json({
      success: true,
      message: "Mot de passe réinitialisé avec succès.",
    });
  } catch (error) {
    console.log(error);
    return next(new HttpError("Erreur lors du reset du mot de passe.", 500));
  }
};

module.exports = {
  createUser,
  verifyEmail,
  newCode,
  login,
  refreshToken,
  logout,
  verifyPhone,
  newPhoneCode,
  requestPasswordReset,
  resetPassword,
  addPhoneNumber,
};
