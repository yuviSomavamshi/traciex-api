const SocketIO = require("socket.io");
const express = require("express");
const router = express.Router();
const authorize = require("../_middleware/authorize");
const Role = require("../_helpers/role");

var io;

router.post("/register", authorize([Role.Staff]), (req, res) => {
  console.log(req.body.receiverName, Object.keys(global.clients));
  if (global.clients.hasOwnProperty(req.body.receiverName)) {
    global.clients[req.body.receiverName].emit("SCAN_QR_CODE_CONFIRM", req.body);
    global.senders[req.user.id] = req.body;
    res.status(201).send({ statusCode: 201, status: "success", message: "Paired Device " + req.body.receiverName });
  } else {
    res.status(404).send({ statusCode: 404, status: "fail", message: "Your partner " + req.body.receiverName + " was gone" });
  }
});

router.post("/check", authorize([Role.Staff]), (req, res) => {
  if (global.senders[req.user.id] && global.clients.hasOwnProperty(global.senders[req.user.id].receiverName)) {
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

  if (!global.senders[req.user.id]) {
    return res.status(409).send({ statusCode: 409, status: "fail", message: "Please follow instructions to pair the device" });
  }
  let receiverName = global.senders[req.user.id].receiverName;
  if (global.clients.hasOwnProperty(receiverName)) {
    global.clients[receiverName].emit(event, req.body);
    res.status(201).send({ statusCode: 201, status: "success", message: "Message delivered" });
  } else {
    res.status(409).send({ statusCode: 409, status: "fail", message: "Your partner " + receiverName + " was gone" });
  }
});
router.post("/disconnect", authorize([Role.Staff]), (req, res) => {
  if (global.senders.hasOwnProperty(req.user.id)) {
    let receiverName = global.senders[req.user.id].receiverName;
    if (global.clients.hasOwnProperty(receiverName)) {
      global.clients[receiverName].emit("DISCONNECT_TIMER", {});
    }
    delete global.senders[req.user.id];
  }

  res.status(200).send({ statusCode: 200, message: "Disconnected" });
});

module.exports = {
  router,
  init: (server) => {
    console.log("Init websocket");
    global.clients = {};
    global.senders = {};
    io = SocketIO(server, {
      cors: {
        origin: "*",
        credentials: false
      }
    });
    io.on("connection", (socket) => {
      socket.on("disconnect", () => {
        console.log("DEVICE_DISCONNECTED", socket.id, socket.username, socket.userId);
        delete global.clients[socket.username];
        delete global.senders[socket.userId];
      });

      socket.on("REGISTER_TIMER", (msg) => {
        socket.username = msg.username;
        global.clients[msg.username] = socket;
        global.clients[msg.username].emit("REGISTER_TIMER_RESP", { status: "success", message: "Socket registered" });
        console.log("REGISTER_TIMER_RESP:", { msg, status: "success", message: "Socket registered" });
      });
    });
  }
};
