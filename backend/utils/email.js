const nodemailer = require("nodemailer");

// 1. Create the transporter (The Postman)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// 2. Define the sending function
const sendWinnerEmail = async (userEmail, itemName, bidAmount) => {
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM, // Sender address
      to: userEmail,                // Receiver address
      subject: "🎉 You Won the Auction!",
      text: `Congratulations! You won the auction for "${itemName}" with a bid of $${bidAmount}.`, 
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h1 style="color: #1aac83;">Congratulations! 🎉</h1>
          <p>You have officially won the auction for:</p>
          <h2 style="border-bottom: 2px solid #eee; padding-bottom: 10px;">${itemName}</h2>
          <p style="font-size: 1.2em;"><strong>Winning Bid:</strong> $${bidAmount}</p>
          <p>Please login to your account to claim your item.</p>
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