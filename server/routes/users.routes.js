const express = require("express");
const { getUsers, getUserById, addAvatar, updateUser } = require("../controllers/user");
const { authenticate } = require("../middlewares/auth");

const router = express.Router();

router.get("/", getUsers);
router.get("/:userId", getUserById);
router.post("/change-avatar", authenticate, addAvatar);
router.post("/update-user/:userId", authenticate, updateUser);

module.exports = router;
