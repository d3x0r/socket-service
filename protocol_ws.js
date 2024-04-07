
"use strict";
const _debug = false;

// build script requires this sort of path...
import { JSOX } from "../../jsox/lib/jsox.mjs"
import { SaltyRNG } from "../srg2/salty_random_generator2.mjs"

const short_generator = SaltyRNG.Id;

const connections = new Map();


export { makeProtocol };

function makeProtocol(client) {

	function send(msg) {
		client.postMessage(msg);
	}

	function makeSocket() {
		const sock = {
			ws: null, // wait until we get a config to actually something...
			id: short_generator(),
			url : null,
			uiLoader : false,
		};
		connections.set(sock.id, sock);
		return sock;
	}

	function handleServiceMessage(e, msg) {
		//const msg = e.data;
		//console.log( "Worker received from main:", msg );
		if (msg.op === "connect") {
			const connection = makeSocket()
			connection.url = new URL( msg.address );
			_debug && console.log("SETTING PROTOCOL: ", connection.id);
			protocol_.connection = connection;

			connection.ws = protocol.connect(msg.address, msg.protocol,
				(msg) => {
					e.source.postMessage({ op: "b", id: connection.id, msg: msg });	
				}
			);
		} else if (msg.op === "send") {
			const socket = connections.get(msg.id);
			if (socket) socket.ws.send(msg.msg);
			else send({ op: "disconnect", id: msg.id }); 
			//else throw new Error( "Socket to send to is closed:"+msg.id );
		} else if (msg.op === "close") {
			const socket = connections.get(msg.id);
			if (socket) socket.ws.close(msg.code, msg.reason);
			//else throw new Error( "Socket to close to is closed:"+msg.id );
		} else {
			console.log("Unhandled message:", msg);
			return false;
		}
		return true;
	}





	const protocol = {
		connect: openSocket,
		//login : login,
		connectTo: openSocket,
		handleServiceMessage,
		serviceLocal: null,  // set in sw.js
		connection: null,
		localStorage : null,   // unused; but set in sw.js
		resourceReply: null,  // set in sw.js
		getSocket( id ) {
			return connections.get(id);
		},
		get connections() { return connections; },
		send(sock, msg) {
			if ("object" === typeof msg) msg = JSOX.stringify(msg);
			const socket = connections.get(sock);
			if (socket) socket.ws.send(msg);
		},

	};

	const protocol_ = protocol; // this is a duplicate because openSocket has parameter 'protocol'

	function openSocket(peer, protocol, cb) {
		const ws = new WebSocket(peer, protocol);
		//console.log( "New connection ID:", protocol_.connectionId );

		//ws.id = protocol_.connection.id;
		const connection = protocol_.connection;
		protocol_.connection = null;
		connection.ws = ws;

		send({ op: "connecting", id: connection.id });

		//console.log( "Got websocket:", ws, Object.getPrototypeOf( ws ) );
		ws.onopen = function () {
			cb({ op: "open" }, ws);
		};
		ws.onmessage = function handleSockMessage(evt) {
			const msg_ = evt.data;
			if (msg_[0] === '\0') { 
				const msg = JSOX.parse(msg_.substr(1)); // kinda hate double-parsing this... 
				if (msg.op === 'got') {
					if (protocol_.resourceReply)
						protocol_.resourceReply(client, msg);
					return;
				}
			} else {
				const msg = JSOX.parse(msg_); // kinda hate double-parsing this... 
				if (msg.op === 'got') {
					if (protocol_.resourceReply)
						protocol_.resourceReply(client, msg);
					return;
				}
				send({ op: 'a', id: connection.id, msg: msg_ }); // just forward this.
			}
		};
		ws.onclose = function doClose(evt) {
			// event is a HTTP socket event type message.
			if (protocol.serviceLocal) {
				if (protocol.serviceLocal.uiSocket === ws.socket) {
					//console.log("clearing ui Socket so it doesn't send?");
					// fetches become default fallback...
					protocol.serviceLocal.uiSocket = null;
				}
			}
			connections.delete(ws.id);
			console.log( "THis disconnect should be coded!", connection )
			cb({ op: "disconnect", id: connection.id, code:evt.code, reason:evt.reason }, ws)
			send({ op: 'c', id: connection.id, code:evt.code, reason:evt.reason }); // just forward this.

			// websocket is closed.
		};
		return ws;
	}



	return protocol;

}

