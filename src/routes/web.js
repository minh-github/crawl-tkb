import express from "express";
import chatBoxController from "../controllers/chatBoxController";

let router = express.Router();

let initWebRoutes = (app) => {
  router.get("/", chatBoxController.getHomePage);

  router.get("/webhook", chatBoxController.getWebHook);

  router.post("/webhook", chatBoxController.postWebHook);

  return app.use("/", router);
};

module.exports = initWebRoutes;
