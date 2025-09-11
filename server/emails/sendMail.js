const { transporter } = require("../config/mails");

const sendCode = async (email, code, firstName, lastName) => {
  const htmlContent = `
    <h3>Vérification de l'adresse e-mail</h3>
    <p>Bonjour ${firstName} ${lastName},</p>
    <p>Voici votre code de vérification :</p>
    <h1 style="color: #007bff; font-size: 24px; letter-spacing: 2px;">${code}</h1>
    <p>Ce code expirera dans <strong>15 minutes</strong>.</p>
    <p>Si vous n'êtes pas à l'origine de cette demande, veuillez ignorer cet e-mail.</p>
    <br/>
    <p>Cordialement,<br/>L'équipe Edu Booster.</p>
  `;

  try {
    await transporter.sendMail({
      from: `"Edu Booster" <no-reply-${process.env.USER_EMAIL}>`,
      to: email,
      subject: "Votre code de vérification",
      html: htmlContent,
    });
  } catch (error) {
    console.error(
      "❌ Erreur lors de l'envoi de l'e-mail de vérification :",
      error.message
    );
    throw new Error("Échec de l'envoi de l'e-mail de vérification");
  }
};

const sendResetCOde = async (email, code, firstName, lastName) => {
  const htmlContent = `
    <h3>Code de modification du mot de passe</h3>
    <p>Bonjour ${firstName} ${lastName},</p>
    <p>Voici votre code de modification :</p>
    <h1 style="color: #007bff; font-size: 24px; letter-spacing: 2px;">${code}</h1>
    <p>Ce code expirera dans <strong>15 minutes</strong>.</p>
    <p>Si vous n'êtes pas à l'origine de cette demande, veuillez ignorer cet e-mail.</p>
    <br/>
    <p>Cordialement,<br/>L'équipe Edu Booster.</p>
  `;

  try {
    await transporter.sendMail({
      from: `"Edu Booster" <no-reply-${process.env.USER_EMAIL}>`,
      to: email,
      subject: "Code de motification",
      html: htmlContent,
    });
  } catch (error) {
    console.error(
      "❌ Erreur lors de l'envoi de l'e-mail de vérification :",
      error.message
    );
    throw new Error("Échec de l'envoi de l'e-mail de vérification");
  }
};

module.exports = { sendCode, sendResetCOde };
