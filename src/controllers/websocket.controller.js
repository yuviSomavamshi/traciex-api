const SocketIO = require("socket.io");
const express = require("express");
const router = express.Router();
const authorize = require("../_middleware/authorize");
const Role = require("../_helpers/role");

const clients = {};
const senders = {};

var io;

router.post("/register", authorize([Role.Staff]), (req, res) => {
  if (clients.hasOwnProperty(req.body.receiverName)) {
    clients[req.body.receiverName].emit("SCAN_QR_CODE_CONFIRM", req.body);
    senders[req.user.id] = req.body;
    clients[req.body.receiverName].userId = req.user.id;
    res.status(201).send({ statusCode: 201, status: "success", message: "Paired Device " + req.body.receiverName });
  } else {
    res.status(404).send({ statusCode: 404, status: "fail", message: "Your partner " + req.body.receiverName + " was gone" });
  }
});

router.post("/check", authorize([Role.Staff]), (req, res) => {
  if (senders[req.user.id] && clients.hasOwnProperty(senders[req.user.id].receiverName)) {
    res.status(200).send({ statusCode: 200, status: "success", message: "Paired Device " + req.body.receiverName });
  } else {
    res.status(404).send({ statusCode: 404, status: "fail", message: "Your partner " + req.body.receiverName + " was gone" });
  }
});

router.post("/timer/:type", authorize([Role.Staff]), (req, res) => {
  let event;
  switch (req.params.type) {
    case "start":
      event = "START_WEB_TIMER";
      break;
    case "stop":
      event = "STOP_WEB_TIMER";
      break;
    case "pause":
      event = "PAUSE_WEB_TIMER";
      break;
    case "resume":
      event = "RESUME_WEB_TIMER";
      break;
    default:
      event = null;
  }

  if (!senders[req.user.id]) {
    return res.status(409).send({ statusCode: 409, status: "fail", message: "Please follow instructions to pair the device" });
  }
  let receiverName = senders[req.user.id].receiverName;
  if (clients.hasOwnProperty(receiverName)) {
    clients[receiverName].emit(event, req.body);
    res.status(201).send({ statusCode: 201, status: "success", message: "Message delivered" });
  } else {
    res.status(409).send({ statusCode: 409, status: "fail", message: "Your partner " + receiverName + " was gone" });
  }
});
router.post("/disconnect", authorize([Role.Staff]), (req, res) => {
  if (senders.hasOwnProperty(req.user.id)) {
    let receiverName = senders[req.user.id].receiverName;
    if (clients.hasOwnProperty(receiverName)) {
      clients[receiverName].emit("DISCONNECT_TIMER", {});
    }
    delete senders[req.user.id];
  }

  res.status(200).send({ statusCode: 201, message: "Disconnected" });
});

module.exports = {
  router,
  init: (server) => {
    io = SocketIO(server, {
      cors: {
        origin: "*",
        credentials: false
      }
    });
    io.on("connection", (socket) => {
      socket.on("disconnect", () => {
        if (socket.username) console.log("DEVICE_DISCONNECTED", socket.username);
        delete clients[socket.username];
        delete senders[socket.userId];
      });

      socket.on("REGISTER_TIMER", (msg) => {
        console.log("REGISTER_TIMER:", msg);
        let username = msg.username;
        socket.username = username;
        clients[username] = socket;
        console.log("REGISTER_TIMER:", { status: "success", message: "Socket registered" });
        socket.emit("REGISTER_TIMER_RESP", { status: "success", message: "Socket registered" });
      });
    });
  }
};
