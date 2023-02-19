const axios = require('axios');
const result = require('dotenv').config({ path: './server.properties' })
const host = result.parsed.host;
const port = result.parsed.port;
const group = "beta15"

const customHeaders = {
	"Content-Type": "application/json",
}
const body = {
	"operation": "GetGroupData",
	"battery": {
		"isActive": true,
		"isCharging": true,
		"percent": 92,
		"timeRemaining": 397808288,
	}

}

createGroup()
async function createGroup() {
	try {
		const res = await axios.post("http://" + host + ":" + port, body, {
			headers: customHeaders,
		});
		console.log(res.data);
	} catch (error) {
		console.error(error);
	};
};