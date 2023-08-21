import express from "express";
import viewEngine from "./config/viewEngine";
import initWebRoute from "./routes/web";
import bodyParser from "body-parser";
import connect from "./database/connect";
// import bacJob from "./job/job";
require("dotenv").config();

connect();

let app = express();

// config file engine
viewEngine(app);

// request to json

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// init web route
initWebRoute(app);

let port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log("chat box is running in port " + port);
});
