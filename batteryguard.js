const axios = require('axios');
const env = require('dotenv').config({ path: './server.properties' });
const mariadb = require('mariadb');
const fcmHeaders = {
	"Authorization": "key=" + env.parsed.key,
	"project_id": env.parsed.projectid,
	"Content-Type": "application/json",
}
const SimpleNodeLogger = require('simple-node-logger'),
	opts = {
		logDirectory: './logs',
		timestampFormat: 'YYYY-MM-DD HH:mm:ss,SSS',
		fileNamePattern: 'batteryguard-<DATE>.log',
		dateFormat: 'YYYY.MM.DD'
	}
const log = SimpleNodeLogger.createRollingFileLogger(opts);

function post(conn, request, response) {
	log.info("Batteryguard is called");
	let body = [];
	request.on('error', (err) => {
		log.error(err);
		response.status(400).json(err);
	}).on('data', (chunk) => {
		body.push(chunk);
	}).on('end', async () => {
		body = Buffer.concat(body).toString();
		const json = JSON.parse(body);
		log.info("test ->" + JSON.stringify(json));
		await doWork(conn, json, response);
	});
};
async function getDevicedata(conn, json) {
	const sql = "select * from devicedata where token = ?";
	return conn.query(sql, [json.sender])
		.then(rows => {
			let device;
			for (let r of rows) {
				device = r;
			}
			return device;
		}).catch(err => {
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
			sendData(conn, json, response);
			break;
		case "UpdateToken":
			updateToken(conn, json, response);
			break;
		case "SendBatteryData":
			sendData(conn, json, response);
			break;
		case "GetGroupData":
			getGroupData(conn, json, response);
			break;
		case "CreateGroup":
			createGroup(conn, json, response);
			break;
		case "JoinGroup":
			joinGroup(conn, json, response);
			break;
		case "RemoveFromGroup":
			removeFromGroup(conn, json, response);
			break;
		case "JoinGroupRequest":
			joinGroupRequest(conn, json, response);
			break;
		case "JoinGroupAccept":
			joinGroupAccept(conn, json, response);
			break;
		case "JoinGroupDeny":
			joinGroupDeny(conn, json, response);
			break;
		case "SignOutDevice":
			signOutDevice(conn, json, response);
			break;
		default:
			let msg = "Operation " + json.operation + " not valid";
			log.error(msg);
			response.status(400).json({ error: msg })
	}
	await updateDeviceData(conn, json);
};
function convertBigInt(json) {
	return JSON.parse(JSON.stringify(json, (_, value) =>
		typeof value === 'bigint'
			? value.toString()
			: value // return everything else unchanged
	));
};

/**
 * @param {mariadb.Connection} conn 
 * @param {JSON} json 
 * @param {Response<any, Record<string, any>, number>} response
 */
async function sendData(conn, json, response) {
	sendGroupOperationMessage(conn, json)
		.then(result => {
			response.status(result).json({ result: 'operation ' + json.operation });
		});
};
async function joinGroupRequest(conn, json, response) {
	sendGroupOperationMessage(conn, json)
		.then(result => {
			let status;
			switch (result) {
				case 200:
					status = 256;
					break;
				default:
					status = result;
					break;
			}
			response.status(status).json({ result: 'operation ' + json.operation });
		}).catch(err => {
			log.error("JoinGroupRequest: " + err);
			response.status(400).json(err);
		});
};
/**
 * @param {mariadb.Connection} conn 
 * @param {JSON} json 
 * @param {Response<any, Record<string, any>, number>} response
 */

async function insertToken(conn, json) {
	const devicename = json.devicename;
	const sql = "INSERT INTO devicedata (token, devicename) values (?,?)";
	const values = [json.sender, devicename];
	return conn.query(sql, values)
		.then(rows => {
			if (rows.affectedRows == "0") {
				log.error('insertTokent hat nicht geklappt: 451');
				return 451; // Insert hat nicht geklappt
			} else {
				log.info("Neues Device: " + devicename);
				return 255; // erfolgreich
			}
		}).catch(err => {
			if (err.errno != 1062) {
				log.error(err);
				return 400;
			} else {
				log.info("InsertToken: Token bereits vorhanden");
				return 255; // token bereits vorhanden - ist ok
			}
		});

}
/**
 * @param {mariadb.Connection} conn 
 * @param {JSON} json 
 * @param {Response<any, Record<string, any>, number>} response
 */
async function updateToken(conn, json, response) {
	const old = json.oldtoken;
	let status;
	if (old == null) {// Token wird erstmalig gesendet - anlegen
		status = await insertToken(conn, json);
		response.status(status).json({ result: 'operation ' + json.operation + ', Status: ' + status });
	} else {
		const sql = "UPDATE devicedata SET token = ? WHERE token = ? "
		conn.query(sql, [json.sender, old])
			.then(rows => {
				status = 404;
				if (rows.affectedRows == "0") {
					status = 451; // Update hat nicht geklappt
				} else {
					status = 255; // Update erfolgreich
					sendGroupOperationMessage(conn, json);
				}
			}).catch(err => {
				log.error(err);
				response.status(400).json(err);
			});
	}

};
/**
 * @param {mariadb.Connection} conn 
 * @param {JSON} json 
 * @param {Response<any, Record<string, any>, number>} response
 */
async function createGroup(conn, json, response) {
	const groupname = json.groupname;
	insertToken(conn, json)
		.then(_ => {
			const members =
				"select count(*) as cnt " +
				",(select subscription from groups where groupname = name) as subscription " +
				"from devicedata where groupname = ?";
			conn.query(members, groupname)
				.then(rows => {
					for (let r of rows) {
						if (r.cnt == "0") {
							// Gruppe ist leer oder nicht existent - anlegen?
							const sql = "Insert into groups (name) values (?) "
							conn.query(sql, [groupname])
								.then(_ => {
									let info = "Neue Gruppe: " + groupname;
									log.info(info);
									response.status(251).json({ result: info });
								})
								.catch(err => {
									if (err.errno == 1062) {
										let info = "Gruppe bereits vorhanden, aber leer: " + groupname;
										log.info(info);
										response.status(251).json({ result: info });
									} else {
										log.error(err);
										response.status(400).json(err);
									}
								});
						} else if (r.cnt == "1") {
							let info = "Gruppe bereits vorhanden (" + r.cnt + "), nicht leer: " + groupname;
							log.info(info);
							response.status(252).json({ result: info });
						} else if (r.subscription != null) {
							let info = "Mit Abo, Gruppe bereits vorhanden(" + r.cnt + "), nicht leer: " + groupname;
							log.info(info);
							response.status(252).json({ result: info });
						} else {
							let info = "Ohne Abo, Gruppe bereits vorhanden(" + r.cnt + "), nicht leer: " + groupname;
							log.info(info);
							response.status(254).json({ result: info });
						};
						break;
					};
				}).catch(err => {
					log.error(err);
					response.status(400).json(err);
				});

		}).catch(err => {
			log.error(err);
			response.status(400).json(err);
		});
};

/**
 * @param {mariadb.Connection} conn 
 * @param {JSON} json 
 * @param {Response<any, Record<string, any>, number>} response
 */

async function joinGroupAccept(conn, json, response) {
	conn.query("Select groupname from devicedata where token = ?", [json.sender])
		.then(result => {
			var status = 404;
			const who = json.who;
			for (let r of result) {
				if (r.groupname != null) {
					const groupname = r.groupname;
					// Gruppe gefunden
					const sql = "UPDATE devicedata SET groupname = ? , isActive = 1 WHERE token = ? "
					conn.query(sql, [groupname, who])
						.then(rows => {
							if (rows.affectedRows == "0") {
								status = 452; // Update hat nicht geklappt - Remote Member ist kein Mitglied der Gruppe
							} else {
								status = 257; // Update erfolgreich
								sendGroupOperationMessage(conn, json)
							}
							response.status(status).json(convertBigInt(rows));
						}).catch(err => {
							log.error(err);
							response.status(400).json(err);
						});
				}
			}
		}).catch(err => {
			log.error(err);
			response.status(404).json(err);

		});
};

/**
 * @param {mariadb.Connection} conn 
 * @param {JSON} json 
 * @param {Response<any, Record<string, any>, number>} response
 */

async function joinGroupDeny(conn, json, response) {
	const messsage = {
		"Content-Type": "application/json",
		"operation": json.operation,
		"to": json.who,
		"data": json
	}
	const result = await sendMessage(conn, messsage);
	response.status(result).json({ result: 'Server ok' });
};

/**
 * @param {mariadb.Connection} conn 
 * @param {JSON} json 
 * @param {Response<any, Record<string, any>, number>} response
 */

async function joinGroup(conn, json, response) {
	const groupname = json.groupname;
	const sender = json.sender;
	const sql = "UPDATE devicedata SET groupname = ?, isActive = 1 WHERE token = ? " +
		"and not exists (SELECT * FROM devicedata WHERE groupname = ? )"
	conn.query(sql, [groupname, sender, groupname])
		.then(rows => {
			var status = 404;
			if (rows.affectedRows == "0") {
				status = 252; // Update hat nicht geklappt - Es gibt schon (mindestens) einen Member in der Gruppe
			} else {
				sendGroupOperationMessage(conn, json);
				status = 253; // Update erfolgreich
			}
			response.status(status).json(convertBigInt(rows));
		}).catch(err => {
			log.error(err);
			response.status(400).json(err);
		});
};
/**
 * @param {mariadb.Connection} conn 
 * @param {JSON} json 
 * @param {Response<any, Record<string, any>, number>} response
 */

async function signOutDevice(conn, json, response) {
	const sender = json.sender;
	const sql = "UPDATE devicedata SET groupname = null, isActive = 0 WHERE token = ? ";
	conn.query(sql, [sender])
		.then(rows => {
			var status = 404;
			if (rows.affectedRows != "0") {
				sendGroupOperationMessage(conn, json);
				status = 258; // SignOut erfolgreich
			}
			response.status(status).json(convertBigInt(rows));
		}).catch(err => {
			log.error(err);
			response.status(400).json(err);
		});
};

/**
 * @param {mariadb.Connection} conn 
 * @param {JSON} json 
 * @param {Response<any, Record<string, any>, number>} response
 */

async function removeFromGroup(conn, json, response) {
	const groupname = json.groupname;
	const token = json.data.token;
	const sql = "UPDATE devicedata SET groupname = NULL, isActive = 0 WHERE token = ? "
	conn.query(sql, [groupname, token])
		.then(rows => {
			sendGroupOperationMessage(conn, json);
			response.status(258).json(convertBigInt(rows));
		}).catch(err => {
			log.error(err);
			response.status(400).json(err);
		});
};
/**
 * @param {mariadb.Connection} conn 
 * @param {JSON} json 
 * @returns reuslt: 250 erfolgreich, 251: Gruppe leer oder keine Member
 */

async function sendGroupOperationMessage(conn, json) {
	if (json.groupname != null) {
		const sql = "SELECT token FROM devicedata WHERE groupname = ? order by token"
		let ids = await conn.query(sql, json.groupname)
			.then(rows => {
				let ids = [];
				for (let row of rows) {
					if (row.token != json.sender) {
						ids.push(row.token);
					}
				}
				return ids
			}).catch(err => {
				log.error("GetTokens group: " + json.groupname + ", Error" + err);
				return [];
			});

		if (ids.length > 0) {
			const message = {
				"Content-Type": "application/json",
				"operation": json.operation,
				"registration_ids": ids,
				"groupname": json.groupname,
				"data": json
			}
			return await sendMessage(conn, message);
		} else {
			log.error("Leere Gruppe: " + json.groupname + ", sender: " + json.sender);
			// Gruppe ist leer (oder nur sich selbst als Member)
			return 251;
		}
	} else {
		log.error("Missing groupname: " + JSON.stringify(json));
		return 250;
	};
};
/**
 * @param {JSON} json 
 * @returns 200: erfolgreich, 450: Fehler
 */

async function sendMessage(conn, message) {
	message.priority = message.data.priority;
	log.info("sendMsg -> " + JSON.stringify(message));
	return axios.post(env.parsed.fcmBase, message, {
		headers: fcmHeaders
	}).then((result) => {
		let json = result.data;
		log.info("sendMsgResult -> " + JSON.stringify(json));
		if (json.failure != "0") {
			executeFCMFailures(conn, message, json.results);
		}
		return 200;
	}).catch(function(error) {
		log.error(error);
		return 450;
	});
};
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
			conn.query(sql, [id])
				.then(_ => {
					let message = {
						"Content-Type": "application/json",
						"operation": "DeleteDevice",
						"sender": id,
						"groupname": body.groupname
					}
					sendGroupOperationMessage(conn, message);
					log.info("Device deleted: " + id);
				})
				.catch(err => {
					log.error("executeFCMFailure: " + err);
				})
		}
	}
};

/**
 * @param {mariadb.Connection} conn 
 * @param {JSON} json 
 * @param {Response<any, Record<string, any>, number>} response
 */

async function getGroupData(conn, json, response) {
	const members = "SELECT * FROM devicedata where groupname = " +
		"(Select groupname from devicedata where token = ? )";
	conn.query(members, [json.sender])
		.then(rows => {
			response.status(200).json(convertBigInt(rows));
		}).catch(err => {
			log.error(err);
			response.status(400).json(err);
		});
};
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
			json.sender
		];
		const sql = "Update devicedata set percent = ? , timeRemaining =? , isCharging = ?,isPlugged = ?, currentAvg = ?, " +
			"low = ?,high = ?, temperature = ? where token = ? ";
		conn.query(sql, values).catch(err => {
			log.error(err);
		});
	};
};

// Adding the code below to allow importing
// the functions in other files
module.exports = { post }