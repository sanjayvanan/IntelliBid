require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const {Server} = require("socket.io")

const userRoutes = require("./routes/user");
const itemRoutes = require("./routes/items");
const connectMongo = require("./db/mongo");
// Start background jobs
require('./jobs/auctionCloser'); 

const app = express();


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

app.use((req, _res, next) => { console.log(req.method, req.path); next(); });

app.use("/api/user", userRoutes);

//Log when users connect to the socket
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
});

// Start
connectMongo()
  .then(() => {
    server.listen(process.env.PORT || 4000, () =>
      console.log("listening on port", process.env.PORT || 4000)
    );
  })
  .catch((err) => {
    console.error("Failed to start server:", err);
  });
