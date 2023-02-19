import axios from 'axios';
import  serverenv from 'dotenv'
const result = serverenv.config({ path: './server.properties' })
const host = result.parsed.host;
const port = result.parsed.port;
const token = "ebHW2nDKTjWErV6T9pZoUz:APA91bEBc9efKC0ljf2rZtivMf6rkCF38glBN6QLjqKToFb1bCl3SZuS96bs_9uXJ_QE6XLY8FEy1gVZLzms8bhFzd9L_POceK_ztrfLu6lK6B5R46Xxn_SSQm4eiJoPpGVi1WRbR-Ks"

const customHeaders = {
	"Content-Type": "application/json",
}
const body = {
	"operation": "CreateGroup",
	"groupname": "theta",
	"sender": token,
	"battery": {
		"isActive": true,
		"isCharging": true,
		"percent": 92,
		"isPlugged": true,
		"timeRemaining": 397808288,
	}

}

addToGroup()
async function addToGroup() {
	try {
		const res = await axios.post("http://" + host + ":" + port, body, {
			headers: customHeaders,
		});
		res.status == 250 ? console.log("frei") : console.log("nicht frei")
	} catch (error) {
		console.error(error);
	};
};