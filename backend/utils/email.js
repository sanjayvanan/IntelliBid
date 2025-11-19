const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Updated to accept paymentLink
const sendWinnerEmail = async (userEmail, itemName, bidAmount, paymentLink) => {
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: userEmail,
      subject: "🎉 You Won! Pay now to claim your item",
      text: `Congratulations! You won "${itemName}" for $${bidAmount}. Pay here: ${paymentLink}`, 
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; border: 1px solid #eee;">
          <h1 style="color: #1aac83;">Congratulations! 🎉</h1>
          <p>You have won the auction for:</p>
          <h2 style="border-bottom: 2px solid #eee; padding-bottom: 10px;">${itemName}</h2>
          <p style="font-size: 1.2em;"><strong>Winning Bid:</strong> $${bidAmount}</p>
          
          <div style="margin: 30px 0;">
            <a href="${paymentLink}" style="background-color: #1aac83; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Pay Now & Claim Item
            </a>
          </div>
          
          <p>Or login to your profile to see your pending payments.</p>
          <br/>
          <p style="font-size: 0.8em; color: #777;">The IntelliBid Team</p>
        </div>
      `,
    });
    console.log("Email sent: %s", info.messageId);
  } catch (error) {
    console.error("Error sending email:", error);
  }
};

module.exports = { sendWinnerEmail };