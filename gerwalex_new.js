const express = require("express");
const app = express();
const http = require("http");
const env = require("dotenv").config({ path: "./server.properties" });
const db = require("dotenv").config({ path: "./db.properties" });
const mariadb = require("mariadb");
const batteryguard = require("./batteryguard_.js");
const pool = mariadb.createPool({
  host: db.parsed.host,
  user: db.parsed.user,
  password: db.parsed.password,
  database: db.parsed.name,
  connectionLimit: 5,
});
const host = env.parsed.host;
const port = env.parsed.port;
const SimpleNodeLogger = require("simple-node-logger"),
  opts = {
    logFilePath: env.parsed.logpath,
    timestampFormat: "YYYY-MM-DD HH:mm:ss",
  };
const log = SimpleNodeLogger.createSimpleLogger(opts);
/**
 * @param { express.Response < any, Record < string, any >, number >} response
 */
app.post("/", (request, response) => {
  try {
    pool
      .getConnection()
      .then((conn) => {
        let body = [];
        request
          .on("error", (err) => {
            log.error(err);
            response.status(400).json(err);
          })
          .on("data", (chunk) => {
            body.push(chunk);
          })
          .on("end", async () => {
            body = Buffer.concat(body).toString();
            const json = JSON.parse(body);
            logDebug("post ->" + JSON.stringify(json));
            let result = await batteryguard.doWork(conn, json);
          });
        conn.end();
      })
      .catch((err) => {
        log.error(err);
        response.status(400).json(err);
        conn.end();
      });
  } catch (err) {
    log.error("getConnection failed: " + err);
    response.status(400).json(err);
  }
});
http
  .createServer(app)
  .listen(port, host)
  .on("listening", () => {
    log.info("BatteryguardServer server started. ");
  })
  .on("error", (e) => {
    log.error("BatteryguardServer server Failure: " + JSON.stringify(e));
  });
