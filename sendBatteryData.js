const http = require('http');
const axios = require('axios');
const result = require('dotenv').config({ path: './server.properties' })
console.log(result.parsed)
const host = result.parsed.host;
const port = result.parsed.port;
const group = "raw-app.com"
const token = "cED_DQLcRuWfmXBWaH5izw:APA91bFjjv-1-W0TZcTH_K98DaCHQpt8wc11-FQPFK5s42g--ohxhREv1jV4wjrAJe4E1S_LlIy77RQKkxue9T1BbNR39FR1SKL6w8jwn03FLfMRrqOlX5TuMh6hj2aFfX57USy_NOtG"

const customHeaders = {
	"Content-Type": "application/json",
}
const body = {
	"operation": "SendBatteryData",
	"sender": "gamma",
	"battery": {
		"isPlugged": true,
		"isActive": true,
		"isCharging": true,
		"percent": 92,
		"currentAvg": 90,
		"timeRemaining": 397808288,
	}
}
const body1 = {

	"battery": {
		"isCharging": true,
		"isPlugged": false,
		"percent": 82,
		"timeRemaining": 10870000
	},
	"devicename": "Tab S7+",
	"groupname": "betabeta",
	"isActive": true,
	"notification": {
		"body": "Gerät Tab S7+ möchte gerne der Gruppe betabeta beitretetn.",
		"notificationID": 1155099827,
		"onGoing": false,
		"onlyAlertOnce": true,
		"time": 1674996991939,
		"title": "Anfrage Gruppe",
		"vibrate": false
	},
	"operation": "JoinGroupRequest",
	"retry": false,
	"sender": "ebHW2nDKTjWErV6T9pZoUz:APA91bEBc9efKC0ljf2rZtivMf6rkCF38glBN6QLjqKToFb1bCl3SZuS96bs_9uXJ_QE6XLY8FEy1gVZLzms8bhFzd9L_POceK_ztrfLu6lK6B5R46Xxn_SSQm4eiJoPpGVi1WRbR-Ks",
	"ts": 1674996991939
}
const body2 = {
	"battery": {
		"currentAvg": -967,
		"isCharging": false,
		"isPlugged": true,
		"percent": 84,
		"timeRemaining": 69437736
	},
	"devicename": "Tab S7+",
	"groupname": "654321",
	"isActive": true,
	"operation": "SendBatteryData",
	"retry": true,
	"sender": "gamma",
	"ts": 1675324756001
}
sendMsg();

async function sendMsg() {
	try {
		//const resp = await axios.post("https://peanutcounter.com/batteryguard", body, {
		const resp = await axios.post("http://" + host + ":" + port, body2, {
			headers: customHeaders,
		});
		console.log(resp.data);
	} catch (error) {
		console.error(error);
	};
};