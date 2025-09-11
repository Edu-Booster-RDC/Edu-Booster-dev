const express = require("express");
const {
  createUser,
  verifyEmail,
  newCode,
  login,
  refreshToken,
  logout,
  newPhoneCode,
  requestPasswordReset,
  resetPassword,
  verifyPhone,
  addPhoneNumber,
} = require("../controllers/auth");
const { authenticate } = require("../middlewares/auth");

const router = express.Router();

// 🔹 Auth de base
router.post("/create", createUser);
router.post("/login", login);
router.post("/refresh-token", refreshToken);
router.post("/logout", authenticate, logout);

// 🔹 Vérification email
router.put("/verify-email", verifyEmail);
router.post("/new-verification-code", newCode);

// 🔹 Vérification téléphone
router.put("/add-phone-number", authenticate, addPhoneNumber);
router.put("/verify-phone", verifyPhone);
router.post("/new-phone-code", newPhoneCode);

// 🔹 Mot de passe oublié / reset
router.post("/request-password-reset", requestPasswordReset);
router.post("/reset-password", resetPassword);

module.exports = router;
