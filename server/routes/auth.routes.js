const express = require("express");
const { createUser, verifyEmail, newCode } = require("../controllers/auth");

const router = express.Router();

router.post("/create", createUser);
router.put("/verify-email", verifyEmail);
router.post("/new-verification-code", newCode);

module.exports = router;
