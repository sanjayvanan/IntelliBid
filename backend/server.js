require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const {Server} = require("socket.io")
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const userRoutes = require("./routes/user");
const itemRoutes = require("./routes/items");
const paymentRoutes = require("./routes/payment");
const chatRoutes = require("./routes/chat");
const connectMongo = require("./db/mongo");
// Start background jobs
const { syncActiveAuctions } = require('./jobs/auctionQueue');

const app = express();
app.use(helmet());

//Configure Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again after 15 minutes"
});

// Apply rate limiter to all requests
app.use(limiter);

//create http server wrapping 
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    // should match the frontend URL 
    origin: process.env.FRONTEND_PORT || "http://localhost:5173", 
    credentials: true
  }
});
app.set('io', io);

app.use(express.json());
app.use(cors({ origin: process.env.FRONTEND_PORT, credentials: true }));
app.use("/api/items", itemRoutes);
app.use("/api/payment", paymentRoutes);

app.use((req, _res, next) => { console.log(req.method, req.path); next(); });

app.use("/api/user", userRoutes);
app.use("/api/chat", chatRoutes);

//Log when users connect to the socket
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
});

// Start
connectMongo()
  .then(() => { // i removed the async here (so the system wont wait for it)
    
    // SCALABILITY FIX:
    // Run sync in the background without blocking server startup.
    syncActiveAuctions()
      .then(() => console.log("✅ Background sync initiated"))
      .catch(err => console.error("❌ Background sync failed:", err));

    server.listen(process.env.PORT || 4000, () =>
      console.log("listening on port", process.env.PORT || 4000)
    );
  })
  .catch((err) => {
    console.error("Failed to start server:", err);
  });