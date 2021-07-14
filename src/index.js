﻿const express = require("express");
const helmet = require("helmet");
const logger = require("morgan");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const marked = require("marked");
const cors = require("cors");
const errorHandler = require("./_middleware/error-handler");
const tls = require("tls");
const path = require("path");
const rateLimit = require("express-rate-limit");
const https = require("https");
const whiteboard = require("./utils/whiteboad");
const RedisMan = require("./utils/redis_man");

require("dotenv").config();
require("./_helpers/db");

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 6000 // limit each IP to 6000 requests per windowMs
});

const redisConfig = {
  host: process.env.REDIS_HOST || "10.2.0.4",
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || "HealthX!Chain123BLR"
};
whiteboard.init(redisConfig);
RedisMan.init(redisConfig);

const app = express();
app.use(limiter);
app.set("trust proxy", 1);
app.set("etag", false); // turning off etag
marked.setOptions({
  sanitize: true
});
app.locals.marked = marked;
app.use(
  helmet.hsts({
    maxAge: 0,
    includeSubDomains: true
  })
);
app.use(
  helmet.frameguard({
    action: "sameorigin"
  })
);

app.use(helmet.xssFilter());
app.use(helmet.noSniff());
app.use(helmet.ieNoOpen());
app.use(helmet.hidePoweredBy());
app.use(logger("dev"));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());

// allow cors requests from any origin and with credentials
const allowlist = ["https://traciex.healthx.global", "http://localhost:3000", "http://127.0.0.1:3000", "http://20.191.153.109"];
const corsOptionsDelegate = (req, callback) => {
  let corsOptions = {
    origin: false,
    credentials: true,
    exposedHeaders: ["set-cookie"]
  };

  let isDomainAllowed = true; //process.env.NODE_ENV === "production" ? allowlist.indexOf(req.header("Origin")) !== -1 : true;
  if (isDomainAllowed) {
    // Enable CORS for this request
    corsOptions.origin = true;
  }
  callback(null, corsOptions);
};

app.use(cors(corsOptionsDelegate));

app.use("/api/v1/static", express.static(path.join(__dirname, "../", "assets")));

app.use("/api/v1/accounts", require("./controllers/accounts.controller"));

app.use("/api/v1/customer", require("./controllers/customer.controller"));

app.use("/api/v1/barcode", require("./controllers/barcode.controller"));

app.use("/api/v1/raman", require("./controllers/raman.controller"));

app.use("/api/v1/bc", require("./controllers/blockchain.controller"));

// global error handler
//app.use(errorHandler);

app.use((req, res) => {
  res.status(404).json({ message: "Resource Not Found." });
});
app.use((err, req, res) => {
  res.status(err.statusCode || 500);
  res.render("error", {
    message: err.message,
    error: app.get("env") === "development" ? err : {}
  });
});

app.use((err, req, res) => {
  return res.status(err.status || 500).json("error", { message: "Internal Server Error." });
});

// start server
const port = process.env.PORT || 443;
const fs = require("fs");
const privateKey = fs.readFileSync(path.join(__dirname, "privkey.pem"), "utf8");
const certificate = fs.readFileSync(path.join(__dirname, "fullchain.pem"), "utf8");

var credentials = { key: privateKey, cert: certificate };

tls.CLIENT_RENEG_LIMIT = 0;
const server = https.createServer(credentials, app);
server.listen(port, () => console.log("Server listening on port " + port));

const io = require("socket.io")(server, {
  cors: {
    origin: "*",
    credentials: true
  }
});

const clients = {};
const senders = {};

io.on("connection", (socket) => {
  socket.on("disconnect", () => {
    if (socket.username) console.log("DEVICE_DISCONNECTED", socket.username);
    delete clients[socket.username];
    if (senders.hasOwnProperty(socket.username)) {
      senders[socket.username].emit("DEVICE_DISCONNECTED", { status: "success", message: "Cleared QR code", senderName: socket.username });
      delete senders[socket.username];
    }
  });
  socket.on("event", (message) => {
    console.log("event:", message);
  });
  socket.on("SCAN_QR_CODE", (msg) => {
    console.log(clients);
    console.log("SCAN_QR_CODE:", msg);
    let receiverName = msg.receiverName;
    if (clients.hasOwnProperty(receiverName)) {
      clients[receiverName].emit("SCAN_QR_CODE_CONFIRM", msg);
      senders[receiverName] = socket;
      console.log({ status: "success", message: "Paired Device", receiverName });
      socket.emit("SCAN_QR_CODE_RESP", { status: "success", message: "Paired Device", receiverName });
    } else {
      socket.emit("SCAN_QR_CODE_RESP", { status: "fail", message: "Invalid QR code" });
    }
  });

  socket.on("REGISTER_TIMER", (msg) => {
    console.log("REGISTER_TIMER:", msg);
    let username = msg.username;
    socket.username = username;
    clients[username] = socket;
    console.log("REGISTER_TIMER:", { status: "success", message: "Socket registered" });
    socket.emit("REGISTER_TIMER_RESP", { status: "success", message: "Socket registered" });
  });

  socket.on("START_TIMER", function (msg) {
    console.log("START_TIMER:", msg);
    if (clients.hasOwnProperty(msg.receiverName)) {
      clients[msg.receiverName].emit("START_WEB_TIMER", msg);
    } else {
      clients[msg.senderName].emit("START_TIMER_RESP", { status: "fail", message: "Your partner " + msg.receiverName + " was gone" });
    }
  });

  socket.on("PAUSE_TIMER", function (msg) {
    console.log("PAUSE_TIMER:", msg);
    if (clients.hasOwnProperty(msg.receiverName)) {
      clients[msg.receiverName].emit("PAUSE_WEB_TIMER", msg);
    } else {
      clients[msg.senderName].emit("PAUSE_TIMER_RESP", { status: "fail", message: "Your partner " + msg.receiverName + " was gone" });
    }
  });
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

process.on("uncaughtException", (err) => {
  console.error("uncaughtException", err);
});

process.on("unhandledRejection", (reason, p) => {
  console.error("unhandledRejection", reason, p);
});

function shutdown() {
  console.log("Received kill signal. Initiating shutdown...");
  process.exit(1);
}

whiteboard.init({
  host: "52.239.82.94",
  port: 6379,
  db: 0,
  password: "HealthX!Chain123BLR"
});

RedisMan.init({
  config: {
    host: "52.239.82.94",
    port: 6379,
    db: 0,
    password: "HealthX!Chain123BLR"
  }
});

