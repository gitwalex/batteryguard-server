const axios = require('axios');
const result = require('dotenv').config({ path: './server.properties' })
const host = result.parsed.host;
const port = result.parsed.port;

const customHeaders = {
	"Content-Type": "application/json",
}
const body = {
	/**	 beta granted membership von gamma zur gruoope alpha.
	*	 Bedingungen: Beta ist member von alpha, beta ist nicht gamma, 
	*
	* UPDATE devicedata SET groupname = 'alpha' WHERE token = 'gamma' AND token != 'beta' 
	* AND EXISTS (SELECT * FROM devicedata WHERE token = 'beta' AND groupname = 'alpha')
	*/


	"operation": "AddToGroupFromRemote",
	"newgroup": "alpha",
	"granttoken": "gamma",
	"battery": {
		"isActive": true,
		"isCharging": true,
		"percent": 92,
		"timeRemaining": 397808288,
	}
}

addToGroup()
async function addToGroup() {
	try {
		const res = await axios.post("http://" + host + ":" + port, body, {
			headers: customHeaders,
		});
		console.log(JSON.parse(res.data));

	} catch (error) {
		console.error(error);
	};
};