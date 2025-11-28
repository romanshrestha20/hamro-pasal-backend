import twilio from "twilio";
import bcrypt from "bcryptjs";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const serviceSid = process.env.TWILIO_SERVICE_SID;

const client = twilio(accountSid, authToken);

const randomOTP = () => {
  return bcrypt.genSaltSync(6).replace(/\D/g, "").slice(0, 6);
};
export const sendOTP = async (phoneNumber) => {
  try {
    const verification = await client.verify
      .services(serviceSid)
      .verifications.create({ to: phoneNumber, channel: "sms" });
    return verification;
  } catch (error) {
    throw new Error("Failed to send OTP: " + error.message);
  }
};

async function createMessage() {
  const message = await client.messages.create({
    body: "please verify your phone number with this code " + randomOTP(),
    from: "+15017122661",
    to: "+15558675310",
  });

  console.log(message.body);
}

export const verifyOTP = async (phoneNumber, code) => {
  try {
    const verificationCheck = await client.verify
      .services(serviceSid)
      .verificationChecks.create({ to: phoneNumber, code: code });
    return verificationCheck;
  } catch (error) {
    throw new Error("Failed to verify OTP: " + error.message);
  }
};
