const { PrismaClient } = require("../generated/prisma");
const HttpError = require("../models/error");
const db = new PrismaClient();

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

module.exports = { getUsers, getUserById };
