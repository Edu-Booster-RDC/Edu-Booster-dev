const { default: axios } = require("axios");
const { base_url, api_key } = require("../config/sms");

const sendOtp = async (to, code) => {
  try {
    const response = await axios.post(
      `${base_url}/sms/2/text/advanced`,
      {
        messages: [
          {
            from: "Edu Booster",
            destinations: [{ to }],
            text: `Voici le code pour vérifier votre numéro de téléphone : ${code}. Veuillez ne le partager avec personne. Ce code expirera dans 10 minutes.`,
          },
        ],
      },
      {
        headers: {
          Authorization: `App ${api_key}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );

    console.log(response.data);
    return response.data;
  } catch (error) {
    throw new Error("Échec de l'envoi du SMS");
  }
};

module.exports = sendOtp;
