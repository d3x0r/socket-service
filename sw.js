// THis is the main service worker service.
//   This handles websocket connections, and hooks into fetch() requests
//   Fetches might be satisified by the websocket, instead of requested over http.
//   This allows a single websocket service connection to serve interface elements also;
//    this can be dynamic images, or static content which is not publically available on a CDN.
//    This can be proprietary software; this can wrap code around websockets also; such as a 
//    transparent socket.IO layer sort of hook.
//
//     Specific forms and UI elmeents might hook themselves here also; but really any HTML element.
//
//   This is built with rollup. `npm run build`

const l_sw = {
	rid: 0,
	clients: new Map(),
	expectations: [],
}


import { makeProtocol } from "./protocol_ws.js"


self.addEventListener("activate", activation);
self.addEventListener("install", installation);

self.addEventListener("fetch", handleFetch);
self.addEventListener("message", handleMessage);


function activation(event) {
	//console.log( "ACTIVATION EVENT:", event );
	//console.log( "Outstanding clients:", l_sw.clients );
	clients.claim();
}

function installation(event) {
	//console.log( "INSTALLATION EVENT:", event );
	//console.log( "Outstanding clients:", l_sw.clients );
}

function resourceReply(client, msg) {
	client = l_sw.clients.get(client.id);
	//console.log( "Handle standard request....", msg, client.requests );
	const reqId = client.requests.findIndex((req) => req.id === msg.id);

	if (reqId >= 0) {
		const req = client.requests[reqId];
		clearTimeout(req.timeout);
		client.requests.splice(reqId, 1);
		const headers = new Headers(msg.response.headers);
		const response = new Response(msg.response.content, { status: msg.response.status, statusText: msg.response.statusText, headers: headers });
		//console.log( "Resolve with ressponce" );
		req.res(response);
	}
	else
		throw new Error("Outstanding request not found");

}

function getMessageClient(event) {
	let oldClient = null;
	if ("source" in event) {
		const clientId = event.source.id;
		oldClient = l_sw.clients.get(clientId);
		if (!oldClient) {
			const newClient = {
				client: event.source
				, requests: []
				, uiSocket: null
				, protocol: null
				, localStorage: null
				, peers: []
			}
			l_sw.clients.set(clientId, newClient);

			newClient.protocol = makeProtocol(newClient.client);
			newClient.protocol.resourceReply = resourceReply;
			newClient.protocol.serviceLocal = l_sw;

			newClient.localStorage = newClient.protocol.localStorage;

			return newClient;
		} else {
			return oldClient;
		}
	}

}

function getClient(event, asClient) {
	let oldClient = null;

	// need to figure out which socket to request on.
	const clientId =
		event.resultingClientId !== ""
			? event.resultingClientId
			: event.clientId;
	//console.log( "Attemping to get id from event instead...", clientId  );

	if (clientId) {
		const oldClient = l_sw.clients.get(clientId);
		if (oldClient) {
			return oldClient;
		}
		const newClient = {
			client: null  // event.source to send events to... but this is fetch result
			, requests: asClient && asClient.requests || []
			, uiSocket: asClient && asClient.uiSocket
			, protocol: asClient && asClient.protocol
			, localStorage: asClient && asClient.localStorage
			, peers: [asClient]
		}
		if (asClient) asClient.peers.push(newClient);
		l_sw.clients.set(clientId, newClient);

		self.clients.get(clientId).then((client) => {
			//console.log( "Clients resolve finally resulted??" );
			if (!client) {
				console.log("Client is not found... not a valid channel.", clientId, self.clients);
				return null;
			}
			newClient.client = client;
			if (!newClient.protocol) {
				newClient.protocol = makeProtocol(client);
				newClient.protocol.resourceReply = resourceReply;
				newClient.protocol.serviceLocal = l_sw;
				newClient.localStorage = newClient.protocol.localStorage;
			}
			//console.log( "Found client...", client );
			newClient.p = null; // outstanding promise no longer needed.
			return newClient;
		}).catch(err => { console.log("Error on getting client:", err) });
		return newClient;
	} else {
		console.log("Message from an unknowable location?!");
		return null;
	}
}


function handleFetch(event) {
	const req = event.request;
	let asClient = null;
	for (var e = 0; e < l_sw.expectations.length; e++) {
		const exp = l_sw.expectations[e];
		if (req.url.endsWith(exp.url)) {
			asClient = exp.client;
			l_sw.expectations.splice(e, 1);
			break;
		}
	}

	const client = getClient(event, asClient);
	const url = new URL( req.url );
	// not only the client; but the specific socket on the client....
let found = null;
	if( client.protocol )
	 for (const [key, ws] of client.protocol.connections){
			if( ws.uiLoader && url.origin === ws.url.origin )
				found = key;
		}
	const sock = found;

	event.respondWith(
		(() => {
			if (!client) {
				console.log("Client hasn't talked yet... and we don't have a socket for it.");
				return fetch(event.request);
			}
			//console.log( "FETCH:", req, client );
			if (req.method === "GET") {
				//console.log( "got Get request:", req.url );
				if (!client) {
					console.log("fetch event on a page we don't have a socket for...");
				}
				if (client && sock) {
					const url = req.url;
					const newEvent = { id: l_sw.rid++, event: event, res: null, rej: null, p: null, timeout: null };
					client.requests.push(newEvent);
					const p = new Promise((res, rej) => {
						newEvent.res = res; newEvent.rej = rej;
						newEvent.timeout = setTimeout(() => {

							console.log("5 second delay elapsed... reject");
							const response = new Response("Timeout", { status: 408, statusText: "Timeout" });
							res(response);
							//client.uiSocket = null;
							const reqId = client.requests.findIndex((client) => client.id === newEvent.id);
							if (reqId >= 0)
								client.requests.splice(reqId);

						}, 5000);
					});
					newEvent.p = p;

					//console.log( "Post event to corect socket...", client.uiSocket );

					client.protocol.send(sock//client.uiSocket
						, { op: "get", url: url, id: newEvent.id });
					return p;
				} else {
					//console.log( "Just ignoreing?", client, client?client.uiSocket:null );
				}
			}
			return fetch(event.request);
		})()
	);
}

function handleMessage(event) {
	const msg = event.data;
	//console.log("HAndle message: (to get client)", msg );
	const client = getMessageClient(event); // captures event.source for later response

	if (msg.op === "Hello") {
		// nothing to do; just setup client.
		//console.log( "Client is:", client.client.id );
	} else if (msg.op === "expect") {
		l_sw.expectations.push({ client: client, url: msg.url });
	} else if (msg.op === "GET") {
		// this comes back in from webpage which
		// actually handled the server's response...
		if (!client)
			console.log("Response to a fetch request to a client that is no longer valid?");
		// echo of fetch event to do actual work....
		// well... something.
		console.log( "Handle standard request....", msg );
		const reqId = client.requests.findIndex((client) => client.id === msg.id);
		if (reqId >= 0) {
			const req = client.requests[reqId];
			client.requests.splice(reqId);
			const headers = new Headers();
			let had_content = 0;
			for( let header in msg.headers ) {
				headers.append( header, msg.headers[header] );
			} 
			const response = new Response(msg.content
				, {
					headers: headers
					, status:msg.status
				 , statusText: msg.statusText
				}
			);
			// and finish the promise which replies to the
			// real client.
			req.p.res(response);
		} else {
			console.log("Failed to find the requested request" + event.data);
		}
	} else if (msg.op === "setUiLoader") {
		const sock = client.protocol.connections.get( msg.socket ); sock.uiLoader = msg.on;
		//client.uiSocket = msg.socket;
	} else if (msg.op === "setLoader") {
		// reply from getItem localStorage.
		client.localStorage.respond(msg.id);
	}
	else {
		if (client && client.protocol)
			client.protocol.handleServiceMessage(event, msg);
	}
}


