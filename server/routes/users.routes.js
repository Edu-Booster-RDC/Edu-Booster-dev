const express = require("express");
const { getUsers, getUserById, addAvatar } = require("../controllers/user");
const { authenticate } = require("../middlewares/auth");

const router = express.Router();

router.get("/", getUsers);
router.get("/:userId", getUserById);
router.post("/change-avatar", authenticate, addAvatar);

module.exports = router;
