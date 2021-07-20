const Router = require("express").Router();

Router.use("/accounts", require("./accounts.controller"));

Router.use("/customer", require("./customer.controller"));

Router.use("/barcode", require("./barcode.controller"));

Router.use("/raman", require("./raman.controller"));

Router.use("/bc", require("./blockchain.controller"));
const WebSocket = require("./websocket.controller");

Router.use("/ws", WebSocket.router);

module.exports = Router;
