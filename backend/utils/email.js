const nodemailer = require("nodemailer");

// SMTP_PORT usually comes in as a string, so normalize it early
const port = Number(process.env.SMTP_PORT) || 587;

// Port 465 expects a secure connection; others usually don’t
const isSecure = port === 465;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port,
  secure: isSecure,

  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },

  /**
   * Some hosting providers (Render, certain VPCs) can have
   * TLS / IPv6 quirks that cause nodemailer to hang silently.
   * These settings trade strictness for reliability.
   */
  tls: {
    rejectUnauthorized: false,
  },

  // Force IPv4 to avoid IPv6 connection timeouts
  family: 4,

  // Fail fast instead of hanging forever
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 10_000,

  // Helpful during setup and debugging; can be disabled later
  logger: true,
  debug: true,
});

const sendWinnerEmail = async (
  userEmail,
  itemName,
  bidAmount,
  paymentLink
) => {
  console.log(`[Email] Sending winner notification to ${userEmail}`);

  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: userEmail,
      subject: "🎉 You won the auction!",
      text: `Congratulations! You won "${itemName}" for $${bidAmount}.
Pay here: ${paymentLink}`,

      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; border: 1px solid #eee;">
          <h1 style="color: #1aac83;">Congratulations! 🎉</h1>

          <p>You’ve won the auction for:</p>

          <h2 style="border-bottom: 2px solid #eee; padding-bottom: 10px;">
            ${itemName}
          </h2>

          <p style="font-size: 1.1em;">
            <strong>Winning bid:</strong> $${bidAmount}
          </p>

          <div style="margin: 30px 0;">
            <a
              href="${paymentLink}"
              style="background-color: #1aac83; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;"
            >
              Pay now & claim your item
            </a>
          </div>

          <p>You can also log in to your account to complete payment.</p>

          <p style="font-size: 0.8em; color: #777; margin-top: 40px;">
            — The IntelliBid Team
          </p>
        </div>
      `,
    });

    console.log(`[Email] Sent successfully (${info.messageId})`);
    return info;
  } catch (err) {
    console.error("[Email] Failed to send winner email", err);
    throw err;
  }
};

module.exports = { sendWinnerEmail };
