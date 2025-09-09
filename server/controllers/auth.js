const HttpError = require("../models/error");
const { PrismaClient } = require("../generated/prisma");
const bcrypt = require("bcryptjs");
const { sendCode } = require("../emails/sendMail");

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

const createUser = async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, phone, password2, role } =
      req.body;
    if (!firstName || !lastName || !email || !phone || !password || !role) {
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
      return next(new HttpError(err.message), 400);
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPass = await bcrypt.hash(password, salt);

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiration = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const user = await db.user.create({
      data: {
        email: newEmail,
        firstName,
        lastName,
        phone,
        password: hashedPass,
        verificationCode: code,
        codeExpiration: expiration,
      },
    });

    await sendCode(
      user.email,
      user.verificationCode,
      user.firstName,
      user.lastName
    );

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
    console.log(error);
    return next(
      new HttpError(error.message || "Une erreur est survenue.", 500)
    );
  }
};

const verifyEmail = async (req, res, next) => {
  try {
    const { code } = req.body; // ✅ fix body parsing
    if (!code) {
      return next(new HttpError("The code is required", 400));
    }

    const user = await db.user.findFirst({
      where: { verificationCode: code },
    });

    if (!user) {
      return next(new HttpError("Invalid verification code", 404));
    }

    if (user.isVerified) {
      return next(new HttpError("This account has already been verified", 400));
    }

    const now = new Date();
    if (user.codeExpiration < now) {
      return res.status(400).json({
        error: "expired",
        email: user.email,
        message: "The code has expired, please request a new one",
      });
    }

    // ✅ update the user in Prisma
    await db.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        verificationCode: null,
        codeExpiration: null,
      },
    });

    return res.status(200).json({ message: "Account verified successfully" });
  } catch (error) {
    console.log(error);
    return next(
      new HttpError(error.message || "Une erreur est survenue.", 500)
    );
  }
};

const newCode = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return next(new HttpError("PLease provide your email", 400));
    }

    const newEmail = email.toLowerCase();
    const user = await db.user.findUnique({ where: { email: newEmail } });
    if (!user) {
      return next(new HttpError("User not found", 404));
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiration = new Date(Date.now() + 15 * 60 * 1000);

    await db.user.update({
      where: { id: user.id },
      data: {
        verificationCode: code,
        codeExpiration: expiration,
      },
    });

    await sendCode(
      user.email,
      code,
      user.firstName,
      user.lastName
    );

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
    console.log(error);
    return next(
      new HttpError(error.message || "Une erreur est survenue.", 500)
    );
  }
};

module.exports = { createUser, verifyEmail, newCode };
