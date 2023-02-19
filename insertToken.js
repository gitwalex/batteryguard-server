const axios = require('axios');
const result = require('dotenv').config({ path: './server.properties' })
const host = result.parsed.host;
const port = result.parsed.port;
const token = "c4-7egp7TEWHhcIBFdUpOb:APA91bFTm0Io7rHe4o9Ac7Z63l4OGxX8RI3vHLqQfWeWWchAIO154VonEi3M1EoeDB15SEtIZV5AMnVMge9FpDaNkj0VOAhlnBgI5Jb7XBwv_Atm-D6H9y5e9yP3L_7w2rs3NzxOxQPe"

const customHeaders = {
	"Content-Type": "application/json",
}
const body = {
	"operation": "UpdateToken",
	"sender": "epsilon1",
	"devicename": "epsilon1"
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