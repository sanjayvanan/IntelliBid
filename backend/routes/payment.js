const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/requireAuth");
const { createOrder, verifyPayment } = require("../controllers/paymentController");

router.post("/order", requireAuth, createOrder);
router.post("/verify", requireAuth, verifyPayment);

module.exports = router;