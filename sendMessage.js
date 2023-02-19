const http = require('http');
const axios = require('axios');
const result = require('dotenv').config({ path: './server.properties' })
console.log(result.parsed)
const host = result.parsed.host;
const port = result.parsed.port;
const group = "raw-app.com"
const token = "ebHW2nDKTjWErV6T9pZoUz:APA91bEBc9efKC0ljf2rZtivMf6rkCF38glBN6QLjqKToFb1bCl3SZuS96bs_9uXJ_QE6XLY8FEy1gVZLzms8bhFzd9L_POceK_ztrfLu6lK6B5R46Xxn_SSQm4eiJoPpGVi1WRbR-Ks"

const customHeaders = {
	"Content-Type": "application/json",
}
const body = {
	"operation": "SendMessage",
	"group": group,
	"to": token,
	"notification": {
		"title": "Portugal vs. Denmark",
		"body": "great match!"
	},
	"data": {
		"devicegroup": "beta",
		"devicename": "S22 Ultra von Alexander",
		"isActive": true,
		"isCharging": true,
		"percent": 93,
		"timeRemaining": 397808288,
		"token": "cP7ara0_TBeL4vrycTdn2u:APA91bG4OZ8fInRf832cnH3WjGpxPYLtwR-uyxUhi0WD5vv9mJCyGHF-WLg5MRwTcEcQaVz6PDBTCOcuJHsFbyscku5QVmZmcCIVlEExRPIJtPj-tH4CPh5R1wpVjMXdDw90L8I1EXXx",
	}
}

axios.post("http://" + host + ":" + port, body, {
	headers: customHeaders,
}).then(resp => {
	console.log(JSON.stringify(resp.data));
}).catch((error) => {
	console.error(error);
});
