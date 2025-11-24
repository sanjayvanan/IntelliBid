const Razorpay = require("razorpay");
const crypto = require("crypto");
const db = require("../db/postgres");
require("dotenv").config();

const instance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// 1. Create Order
const createOrder = async (req, res) => {
  try {
    const { amount, itemId } = req.body;

    const options = {
      amount: amount * 100, // Razorpay expects amount in paise (INR) or smallest currency unit
      currency: "INR", // Changed to INR for UPI support usually
      receipt: `receipt_item_${itemId}`,
    };

    const order = await instance.orders.create(options);

    if (!order) return res.status(500).send("Some error occured");

    res.json(order);
  } catch (error) {
    console.log(error);
    res.status(500).send(error);
  }
};

// 2. Verify Payment
const verifyPayment = async (req, res) => {
  try {
    // 1. Receive 'shippingAddress' from the request body
    const {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      itemId,
      shippingAddress
    } = req.body;

    // ... signature verification logic (shasum stuff) ...
    const shasum = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
    shasum.update(`${razorpayOrderId}|${razorpayPaymentId}`);
    const digest = shasum.digest("hex");

    if (digest !== razorpaySignature) {
      return res.status(400).json({ msg: "Transaction not legit!" });
    }

    // 2. Update DB with Payment ID, Status AND Shipping Address
    await db.query(
      `UPDATE items 
       SET payment_status = 'paid', 
           razorpay_payment_id = $1, 
           shipping_address = $2 
       WHERE id = $3`,
      [razorpayPaymentId, shippingAddress, itemId]
    );

    res.json({
      msg: "success",
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send(error);
  }
};

module.exports = { createOrder, verifyPayment };