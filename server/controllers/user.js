const { PrismaClient } = require("../generated/prisma");
const HttpError = require("../models/error");
const db = new PrismaClient();
const fs = require("fs");
const path = require("path");
const { v4: uuid } = require("uuid");
const { sendCode } = require("../emails/sendMail");
const sendOtp = require("../emails/sms");

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

    return res.status(200).json({
      success: true,
      res: { users },
      count: users.length,
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des utilisateurs:", error);
    return next(
      new HttpError("Impossible de récupérer les utilisateurs.", 500)
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
      return next(new HttpError("Utilisateur non trouvé.", 404));
    }

    return res.status(200).json({
      success: true,
      res: user,
    });
  } catch (error) {
    console.error("Erreur lors de la récupération d’un utilisateur:", error);
    return next(new HttpError("Impossible de récupérer l’utilisateur.", 500));
  }
};

const addAvatar = async (req, res, next) => {
  try {
    if (!req.files || !req.files.avatar) {
      return next(new HttpError("Veuillez télécharger une image.", 400));
    }

    const user = await db.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user) {
      return next(new HttpError("Utilisateur non trouvé.", 404));
    }

    // Supprimer l’ancien avatar s’il existe
    if (user.avatarUrl) {
      const oldPath = path.join(__dirname, "..", "uploads", user.avatarUrl);
      fs.unlink(oldPath, (err) => {
        if (err)
          console.warn("Échec de la suppression de l’ancien avatar:", err);
      });
    }

    const { avatar } = req.files;

    if (avatar.size > 2 * 1024 * 1024) {
      return next(
        new HttpError("Le fichier est trop volumineux (max 2MB).", 400)
      );
    }

    const splittedFilename = avatar.name.split(".");
    const newFilename =
      splittedFilename[0] + "-" + uuid() + "." + splittedFilename.pop();

    avatar.mv(
      path.join(__dirname, "..", "uploads", newFilename),
      async (err) => {
        if (err) {
          console.error("Erreur lors de l’enregistrement de l’avatar:", err);
          return next(
            new HttpError("Échec du téléchargement du fichier.", 500)
          );
        }

        try {
          const updatedUser = await db.user.update({
            where: { id: req.user.id },
            data: { avatarUrl: newFilename },
          });

          return res.status(200).json({
            success: true,
            res: updatedUser,
          });
        } catch (updateError) {
          console.error(
            "Erreur lors de la mise à jour de l’avatar:",
            updateError
          );
          return next(
            new HttpError("Impossible de mettre à jour l’avatar.", 500)
          );
        }
      }
    );
  } catch (error) {
    console.error("Erreur dans addAvatar:", error);
    return next(
      new HttpError(
        "Une erreur est survenue lors du téléchargement de l’avatar.",
        500
      )
    );
  }
};

const updateUser = async (req, res, next) => {
  const { userId } = req.params;

  try {
    const existingUser = await db.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      return next(new HttpError("Utilisateur non trouvé.", 404));
    }

    const updatableFields = [
      "email",
      "firstName",
      "lastName",
      "phone",
      "avatarUrl",
    ];
    const updateData = {};

    for (const field of updatableFields) {
      if (req.body.hasOwnProperty(field)) {
        updateData[field] = req.body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return next(
        new HttpError("Aucun champ valide fourni pour la mise à jour.", 400)
      );
    }

    const isEmailUpdated =
      updateData.email && updateData.email !== existingUser.email;
    const isPhoneUpdated =
      updateData.phone && updateData.phone !== existingUser.phone;

    if (isEmailUpdated || isPhoneUpdated) {
      const expiration = new Date(Date.now() + 10 * 60 * 1000); // 10 min

      if (isEmailUpdated) {
        updateData.verificationCode = Math.floor(
          100000 + Math.random() * 900000
        ).toString();
        updateData.codeExpiration = expiration;
      }

      if (isPhoneUpdated) {
        updateData.phoneVerificationCode = Math.floor(
          100000 + Math.random() * 900000
        ).toString();
        updateData.phoneCodeExpiration = expiration;
      }
    }

    const updatedUser = await db.user.update({
      where: { id: userId },
      data: updateData,
    });

    // Envoi des OTP si nécessaire
    if (isEmailUpdated) {
      try {
        await sendCode(
          updatedUser.email,
          updatedUser.verificationCode,
          updatedUser.firstName,
          updatedUser.lastName
        );
      } catch (mailError) {
        console.error(
          "Erreur lors de l’envoi du code de vérification email:",
          mailError
        );
      }
    }

    if (isPhoneUpdated) {
      try {
        await sendOtp(updatedUser.phone, updatedUser.phoneVerificationCode);
      } catch (smsError) {
        console.error(
          "Erreur lors de l’envoi du code de vérification SMS:",
          smsError
        );
      }
    }

    return res.status(200).json({
      success: true,
      res: updatedUser,
    });
  } catch (error) {
    console.error("Erreur lors de la mise à jour de l’utilisateur:", error);
    return next(
      new HttpError(
        "Une erreur est survenue lors de la mise à jour de l’utilisateur.",
        500
      )
    );
  }
};

const getCurrentUser = async (req, res, next) => {
  try {
    const userId = req.user.id;

    if (!userId) {
      return next(new HttpError("Utilisateur invalide.", 401));
    }

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
      return next(new HttpError("Utilisateur introuvable.", 404));
    }

    res.status(200).json({
      success: true,
      res: user,
    });
  } catch (error) {
    console.error(
      "Erreur lors de la récupération de l'utilisateur courant:",
      error
    );
    return next(
      new HttpError(error.message || "Une erreur interne est survenue.", 500)
    );
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return next(new HttpError("Utilisateur introuvable.", 404));
    }

    await db.user.delete({
      where: { id: userId },
    });

    res.status(200).json({
      success: true,
      message: "Utilisateur supprimé avec succès.",
    });
  } catch (error) {
    console.error("Erreur lors de la suppression de l'utilisateur:", error);
    return next(
      new HttpError(
        error.message || "Impossible de supprimer l'utilisateur.",
        500
      )
    );
  }
};

module.exports = {
  getUsers,
  getUserById,
  addAvatar,
  updateUser,
  getCurrentUser,
  deleteUser,
};
