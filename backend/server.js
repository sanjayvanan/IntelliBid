require("dotenv").config();
const express = require("express");
const cors = require("cors");

const userRoutes = require("./routes/user");
const itemRoutes = require("./routes/items");
const connectMongo = require("./db/mongo");
// Start background jobs
require('./jobs/auctionCloser'); // Adjust path if needed

const app = express();

app.use(cors({ origin: process.env.FRONTEND_PORT, credentials: true }));
app.use("/api/items", itemRoutes);

app.use(express.json());
app.use((req, _res, next) => { console.log(req.method, req.path); next(); });

app.use("/api/user", userRoutes);

// Start
connectMongo()
  .then(() => {
    app.listen(process.env.PORT || 4000, () =>
      console.log("listening on port", process.env.PORT || 4000)
    );
  })
  .catch((err) => {
    console.error("Failed to start server:", err);
  });
