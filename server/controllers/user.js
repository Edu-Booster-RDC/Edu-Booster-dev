const { PrismaClient } = require("../generated/prisma");
const HttpError = require("../models/error");
const db = new PrismaClient();
const fs = require("fs");
const path = require("path");
const { v4: uuid } = require("uuid");

const getUsers = async (req, res, next) => {
  try {
    const users = await db.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        phone: true,
        avatarUrl: true,
        enrolledAt: true,
        lastLogin: true,
        isVerified: true,
        schoolInfo: true,
      },
    });

    res.status(200).json({
      success: true,
      res: { users },
      count: users.length,
    });
  } catch (error) {
    console.log(error);
    return next(
      new HttpError(error.message || "Une erreur est survenue.", 500)
    );
  }
};

const getUserById = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        phone: true,
        avatarUrl: true,
        enrolledAt: true,
        lastLogin: true,
        isVerified: true,
        schoolInfo: true,
      },
    });

    if (!user) {
      return next(new HttpError("User not found", 404));
    }

    res.status(200).json({
      success: true,
      res: user,
    });
  } catch (error) {
    console.error(error);
    return next(
      new HttpError(error.message || "Une erreur est survenue.", 500)
    );
  }
};

const addAvatar = async (req, res, next) => {
  try {
    if (!req.files || !req.files.avatar) {
      return next(new HttpError("Please choose an image", 400));
    }

    const user = await db.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user) {
      return next(new HttpError("User not found", 404));
    }

    // If user already has an avatar, delete the old one
    if (user.avatarUrl) {
      fs.unlink(
        path.join(__dirname, "..", "uploads", user.avatarUrl),
        (err) => {
          if (err) {
            console.error("Failed to delete old avatar:", err);
          }
        }
      );
    }

    const { avatar } = req.files;

    if (avatar.size > 2 * 1024 * 1024) {
      return next(new HttpError("The file is too big, max 2MB allowed", 400));
    }

    const splittedFilename = avatar.name.split(".");
    const newFilename =
      splittedFilename[0] + "-" + uuid() + "." + splittedFilename.pop();

    avatar.mv(
      path.join(__dirname, "..", "uploads", newFilename),
      async (err) => {
        if (err) {
          return next(new HttpError(err.message || "File upload failed", 500));
        }

        try {
          const updatedAvatar = await db.user.update({
            where: { id: req.user.id },
            data: { avatarUrl: newFilename },
          });

          res.status(200).json({
            success: true,
            user: updatedAvatar,
          });
        } catch (updateError) {
          return next(
            new HttpError(
              updateError.message || "Failed to update avatar.",
              500
            )
          );
        }
      }
    );
  } catch (error) {
    console.error(error);
    return next(
      new HttpError(error.message || "Une erreur est survenue.", 500)
    );
  }
};

module.exports = { getUsers, getUserById, addAvatar };
