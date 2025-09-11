const express = require("express");
const {
  getUsers,
  getUserById,
  addAvatar,
  updateUser,
  getCurrentUser,
  deleteUser,
  addPhoneNumber,
} = require("../controllers/user");
const { authenticate, authorize } = require("../middlewares/auth");

const router = express.Router();

router.get("/me", authenticate, getCurrentUser);
router.get("/", authenticate, authorize("ADMIN"), getUsers);
router.get("/:userId", getUserById);
router.post("/change-avatar", authenticate, addAvatar);
router.post("/update-user/:userId", authenticate, updateUser);
router.delete("/:userId", authenticate, authorize("ADMIN"), deleteUser);

module.exports = router;
