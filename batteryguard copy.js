const axios = require("axios");
const env = require("dotenv").config({ path: "./server.properties" });
const mariadb = require("mariadb");
const fcmHeaders = {
  Authorization: "key=" + env.parsed.key,
  project_id: env.parsed.projectid,
  "Content-Type": "application/json",
};
const SimpleNodeLogger = require("simple-node-logger"),
  opts = {
    logDirectory: "./logs",
    timestampFormat: "YYYY-MM-DD HH:mm:ss,SSS",
    fileNamePattern: "batteryguard-<DATE>.log",
    dateFormat: "YYYY.MM.DD",
  };
const log = SimpleNodeLogger.createRollingFileLogger(opts);

const isDevel = process.env.NODE_ENV == "development";

function logDebug(text) {
  if (isDevel) {
    log.info(text);
  }
}

async function getDevicedata(conn, json) {
  const sql = "select * from devicedata where token = ?";
  return conn
    .query(sql, [json.sender])
    .then((rows) => {
      let device;
      for (let r of rows) {
        device = r;
      }
      return device;
    })
    .catch((err) => {
      log.error(err);
    });
}
/**
 * @param {Object} json
 * @param {Response<any, Record<string, any>, number>} response
 */
const doWork = async (conn, json, response) => {
  switch (json.operation) {
    case "SendMessage":
      return sendData();
      break;
    case "UpdateToken":
      return updateToken(conn, json);
      break;
    case "SendBatteryData":
      return sendData(conn, json);
      break;
    case "GetGroupData":
      return getGroupData(conn, json);
      break;
    case "CreateGroup":
      return createGroup(conn, json);
      break;
    case "JoinGroup":
      return joinGroup(conn, json);
      break;
    case "RemoveFromGroup":
      return removeFromGroup(conn, json);
      break;
    case "JoinGroupRequest":
      return joinGroupRequest(conn, json);
      break;
    case "JoinGroupAccept":
      return joinGroupAccept(conn, json);
      break;
    case "JoinGroupDeny":
      return joinGroupDeny(conn, json);
      break;
    case "SignOutDevice":
      return signOutDevice(conn, json);
      break;
    case "Echo":
      return sendEcho(conn, json);
      break;
    default:
      let msg = "Operation " + json.operation + " not valid";
      log.error(msg);
      return 400;
  }
  await updateDeviceData(conn, json);
};
function convertBigInt(json) {
  return JSON.parse(
    JSON.stringify(
      json,
      (_, value) => (typeof value === "bigint" ? value.toString() : value) // return everything else unchanged
    )
  );
}

/**
 * @param {mariadb.Connection} conn
 * @param {JSON} json
 * @param {Response<any, Record<string, any>, number>} response
 */
async function sendData(conn, json) {
  return await sendGroupOperationMessage(conn, json);
}
async function joinGroupRequest(conn, json) {
  return await sendGroupOperationMessage(conn, json)
    .then((result) => {
      let status;
      switch (result) {
        case 200:
          status = 256;
          break;
        default:
          status = result;
          break;
      }
      return status;
    })
    .catch((err) => {
      log.error("JoinGroupRequest: " + err);
      return 400;
    });
}
/**
 * @param {mariadb.Connection} conn
 * @param {JSON} json
 * @param {Response<any, Record<string, any>, number>} response
 */

async function insertToken(conn, json) {
  const devicename = json.devicename;
  const sql = "INSERT INTO devicedata (token, devicename) values (?,?)";
  const values = [json.sender, devicename];
  return conn
    .query(sql, values)
    .then((rows) => {
      if (rows.affectedRows == "0") {
        log.error("insertToken hat nicht geklappt: 451");
        return 451; // Insert hat nicht geklappt
      } else {
        log.info("Neues Device: " + devicename);
        return 255; // erfolgreich
      }
    })
    .catch((err) => {
      if (err.errno != 1062) {
        log.error(err);
        return 400;
      } else {
        logDebug("InsertToken: Token bereits vorhanden");
        return 255; // token bereits vorhanden - ist ok
      }
    });
}
/**
 * @param {mariadb.Connection} conn
 * @param {JSON} json
 * @param {Response<any, Record<string, any>, number>} response
 */
async function updateToken(conn, json) {
  const old = json.oldtoken;
  let status;
  if (old == null) {
    // Token wird erstmalig gesendet - anlegen
    return await insertToken(conn, json);
  } else {
    const sql = "UPDATE devicedata SET token = ? WHERE token = ? ";
    return await conn
      .query(sql, [json.sender, old])
      .then((rows) => {
        status = 404;
        if (rows.affectedRows == "0") {
          status = 451; // Update hat nicht geklappt
        } else {
          status = 255; // Update erfolgreich
          sendGroupOperationMessage(conn, json);
        }
        return status;
      })
      .catch((err) => {
        log.error(err);
        return 400;
      });
  }
}
/**
 * @param {mariadb.Connection} conn
 * @param {JSON} json
 * @param {Response<any, Record<string, any>, number>} response
 */
async function createGroup(conn, json) {
  const groupname = json.groupname;
  return await insertToken(conn, json)
    .then(async(_) => {
      const members =
        "select count(*) as cnt " +
        ",(select subscription from groups where groupname = name) as subscription " +
        "from devicedata where groupname = ?";
    return await  conn
        .query(members, groupname)
        .then((rows) => {
          for (let r of rows) {
            if (r.cnt == "0") {
              // Gruppe ist leer oder nicht existent - anlegen?
              const sql = "Insert into groups (name) values (?) ";
              conn
                .query(sql, [groupname])
                .then((_) => {
                  let info = "Neue Gruppe: " + groupname;
                  log.info(info);
                  response.status(251).json({ result: info });
                })
                .catch((err) => {
                  if (err.errno == 1062) {
                    let info =
                      "Gruppe bereits vorhanden, aber leer: " + groupname;
                    log.info(info);
                    response.status(251).json({ result: info });
                  } else {
                    log.error(err);
                    response.status(400).json(err);
                  }
                });
            } else if (r.cnt == "1") {
              let info =
                "Gruppe bereits vorhanden (" +
                r.cnt +
                "), nicht leer: " +
                groupname;
              log.info(info);
              response.status(252).json({ result: info });
            } else if (r.subscription != null) {
              let info =
                "Mit Abo, Gruppe bereits vorhanden(" +
                r.cnt +
                "), nicht leer: " +
                groupname;
              log.info(info);
              response.status(252).json({ result: info });
            } else {
              let info =
                "Ohne Abo, Gruppe bereits vorhanden(" +
                r.cnt +
                "), nicht leer: " +
                groupname;
              log.info(info);
              response.status(254).json({ result: info });
            }
            break;
          }
        })
        .catch((err) => {
          log.error(err);
          response.status(400).json(err);
        });
    })
    .catch((err) => {
      log.error(err);
      response.status(400).json(err);
    });
}

/**
 * @param {mariadb.Connection} conn
 * @param {JSON} json
 * @param {Response<any, Record<string, any>, number>} response
 */

async function joinGroupAccept(conn, json, response) {
  conn
    .query("Select groupname from devicedata where token = ?", [json.sender])
    .then((result) => {
      var status = 404;
      const who = json.who;
      for (let r of result) {
        if (r.groupname != null) {
          const groupname = r.groupname;
          // Gruppe gefunden
          const sql =
            "UPDATE devicedata SET groupname = ? , isActive = 1 WHERE token = ? ";
          conn
            .query(sql, [groupname, who])
            .then((rows) => {
              if (rows.affectedRows == "0") {
                status = 452; // Update hat nicht geklappt - Remote Member ist kein Mitglied der Gruppe
              } else {
                status = 257; // Update erfolgreich
                sendGroupOperationMessage(conn, json);
              }
              response.status(status).json(convertBigInt(rows));
            })
            .catch((err) => {
              log.error(err);
              response.status(400).json(err);
            });
        }
      }
    })
    .catch((err) => {
      log.error(err);
      response.status(404).json(err);
    });
}

/**
 * @param {mariadb.Connection} conn
 * @param {JSON} json
 * @param {Response<any, Record<string, any>, number>} response
 */

async function sendEcho(conn, json, response) {
  var d = new Date();
  var n = d.toLocaleTimeString();
  const messsage = {
    "Content-Type": "application/json",
    operation: json.operation,
    to: json.sender,
    notification: {
      title: "Battery Guard",
      body: `Message received at ${n}`,
    },
    data: json,
  };
  const result = await sendMessage(conn, messsage);
  response.status(result).json({ result: "Server ok" });
}
/**
 * @param {mariadb.Connection} conn
 * @param {JSON} json
 * @param {Response<any, Record<string, any>, number>} response
 */

async function joinGroupDeny(conn, json, response) {
  const messsage = {
    "Content-Type": "application/json",
    operation: json.operation,
    to: json.who,
    data: json,
  };
  const result = await sendMessage(conn, messsage);
  response.status(result).json({ result: "Server ok" });
}

/**
 * @param {mariadb.Connection} conn
 * @param {JSON} json
 * @param {Response<any, Record<string, any>, number>} response
 */

async function joinGroup(conn, json, response) {
  const groupname = json.groupname;
  const sender = json.sender;
  const sql =
    "UPDATE devicedata SET groupname = ?, isActive = 1 WHERE token = ? " +
    "and not exists (SELECT * FROM devicedata WHERE groupname = ? )";
  conn
    .query(sql, [groupname, sender, groupname])
    .then((rows) => {
      var status = 404;
      if (rows.affectedRows == "0") {
        status = 252; // Update hat nicht geklappt - Es gibt schon (mindestens) einen Member in der Gruppe
      } else {
        sendGroupOperationMessage(conn, json);
        status = 253; // Update erfolgreich
      }
      response.status(status).json(convertBigInt(rows));
    })
    .catch((err) => {
      log.error(err);
      response.status(400).json(err);
    });
}
/**
 * @param {mariadb.Connection} conn
 * @param {JSON} json
 * @param {Response<any, Record<string, any>, number>} response
 */

async function signOutDevice(conn, json, response) {
  const sender = json.sender;
  const sql =
    "UPDATE devicedata SET groupname = null, isActive = 0 WHERE token = ? ";
  conn
    .query(sql, [sender])
    .then((rows) => {
      var status = 404;
      if (rows.affectedRows != "0") {
        sendGroupOperationMessage(conn, json);
        status = 258; // SignOut erfolgreich
      }
      response.status(status).json(convertBigInt(rows));
    })
    .catch((err) => {
      log.error(err);
      response.status(400).json(err);
    });
}

/**
 * @param {mariadb.Connection} conn
 * @param {JSON} json
 * @param {Response<any, Record<string, any>, number>} response
 */

async function removeFromGroup(conn, json, response) {
  const groupname = json.groupname;
  const token = json.data.token;
  const sql =
    "UPDATE devicedata SET groupname = NULL, isActive = 0 WHERE token = ? ";
  conn
    .query(sql, [groupname, token])
    .then((rows) => {
      sendGroupOperationMessage(conn, json);
      response.status(258).json(convertBigInt(rows));
    })
    .catch((err) => {
      log.error(err);
      response.status(400).json(err);
    });
}

/**
 * @param {mariadb.Connection} conn
 * @param {JSON} json
 * @returns reuslt: 250 erfolgreich, 251: Gruppe leer oder keine Member
 */

async function sendGroupOperationMessage(conn, json) {
  const sql = "SELECT token FROM devicedata WHERE groupname = ? order by token";
  return await conn
    .query(sql, json.groupname)
    .then(async (rows) => {
      if (rows.length == 0) {
        log.error(
          "Leere Gruppe: " +
            json.groupname +
            ", sender: " +
            json.sender.slice(0, 12)
        );
        return 251;
      }
      let ids = [];
      for (let row of rows) {
        if (row.token != json.sender) {
          ids.push(row.token);
        }
      }
      if (ids.length != 0) {
        const message = {
          "Content-Type": "application/json",
          operation: json.operation,
          registration_ids: ids,
          groupname: json.groupname,
          data: json,
        };
        return await sendMessage(conn, message);
      } else {
        return 250;
      }
    })
    .catch((err) => {
      log.error("GetTokens group: " + json.groupname + ", Error" + err);
      return 251;
    });
}
/**
 * @param {JSON} json
 * @returns 200: erfolgreich, 450: Fehler
 */

async function sendMessage(conn, message) {
  message.priority = message.data.priority;
  return axios
    .post(env.parsed.fcmBase, message, {
      headers: fcmHeaders,
    })
    .then((result) => {
      let json = result.data;
      if (json.failure != "0") {
        log.info("sendMsg -> " + JSON.stringify(message));
        log.info("sendMsgResult -> " + JSON.stringify(json));
        executeFCMFailures(conn, message, json.results);
      }
      return 200;
    })
    .catch(function (error) {
      log.error(error);
      return 450;
    });
}
/**
 * Entfernt unregistrierte Devices aus der DB (können nicht mehr erreicht werden).
 * Sendet 'DeleteDevice' an die Gruppe
 * @param {mariadb.Connection} conn
 * @param {JSONArray} results
 */
async function executeFCMFailures(conn, body, results) {
  const ids = body.to || body.registration_ids;
  for (let index = 0; index < results.length; index++) {
    let id = ids[index];
    let result = results[index];
    if (result.error == "NotRegistered") {
      sql = "delete from devicedata where token = ?";
      conn
        .query(sql, [id])
        .then((_) => {
          let message = {
            "Content-Type": "application/json",
            operation: "DeleteDevice",
            sender: id,
            groupname: body.groupname,
          };
          sendGroupOperationMessage(conn, message);
          log.info("Device deleted: " + id.slice(0, 10));
        })
        .catch((err) => {
          log.error("executeFCMFailure: " + err);
        });
    }
  }
}

/**
 * @param {mariadb.Connection} conn
 * @param {JSON} json
 * @param {Response<any, Record<string, any>, number>} response
 */

async function getGroupData(conn, json, response) {
  const members =
    "SELECT * FROM devicedata where groupname = " +
    "(Select groupname from devicedata where token = ? )";
  conn
    .query(members, [json.sender])
    .then((rows) => {
      response.status(200).json(convertBigInt(rows));
    })
    .catch((err) => {
      log.error(err);
      response.status(400).json(err);
    });
}
/**
 * @param {Object} json Json-Object
 */
async function updateDeviceData(conn, json) {
  if (json.battery != null) {
    const values = [
      json.battery.percent,
      json.battery.timeRemaining,
      json.battery.isCharging,
      json.battery.isPlugged,
      json.battery.currentAvg || -1,
      json.battery.low || null,
      json.battery.high || null,
      json.battery.temperature || null,
      json.version || null,
      json.sender,
    ];
    const sql =
      "Update devicedata set percent = ? , timeRemaining =? , isCharging = ?,isPlugged = ?, currentAvg = ?, " +
      "low = ?,high = ?, temperature = ?, version = ? where token = ? ";
    conn.query(sql, values).catch((err) => {
      log.error(err);
    });
  }
}

// Adding the code below to allow importing
// the functions in other files
module.exports = { post };
