import { SaltyRNG } from "/node_modules/@d3x0r/srg2/salty_random_generator2.mjs"
const regenerator = SaltyRNG.id;
const generator = SaltyRNG.id;
const short_generator = SaltyRNG.id;

import { JSOX } from "/node_modules/jsox/lib/jsox.mjs"

const idGen = { generator: generator, regenerator: regenerator }
const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;

const workerInterface = {
	connect: connect,
	uiSocket: null,
	setUiLoader(protocol) {
		workerInterface.uiSocket = protocol;
		l.worker.postMessage({ op: "setUiLoader", socket: protocol.socket });
	},
	expect(url) {
		// notify worker that another page will be
		// loaded soon, and that this client socket is also
		// used for that.
		l.worker.postMessage({ op: "expect", url: url });
	},
	initWorker: initWorker
}

const l = {
	requestSocket: null,
	reg: null,
	worker: null,
	connects: [],
	logins: [],
	sockets: new Map(),

};

const config = {
	run: {
		devkey: localStorage.getItem("devkey"),
		clientKey: localStorage.getItem("clientKey"),
		sessionKey: localStorage.getItem("sessionKey")
	}
};

function initWorker() {

	navigator.serviceWorker.register('/socket-service-swbundle.js', { scope: '/' }).then(function (registration) {
		// Registration was successful
		l.reg = registration;
		// poll for ready...
		tick();
	}, function (err) {
		// registration failed :(
		console.log('ServiceWorker registration failed: ', err);
	});

	function tick() {
		if (!l.worker) {
			l.worker = l.reg.active;
			if (l.worker) {
				//console.log( "Sending hello." );
				l.worker.postMessage({ op: "Hello" });
				if (l.connects.length)
					for (let msg of l.connects) {
						l.worker.postMessage(msg.msg);
					}
			} else {
				//setTimeout( tick, 100 );
			}
		}
	}

	navigator.serviceWorker.ready.then(registration => {
		//console.log( "THIS IS READY?" );
		l.reg = registration;
		tick();
	});

	navigator.serviceWorker.addEventListener("message", handleMessage);

}

function makeSocket(sockid, from) {
	//console.log( "making a socket.." );
	const socket = {
		socket: sockid,
		setUiLoader() {
			workerInterface.setUiLoader(socket);
		},
		from: from, // track redirect for reconnect?
		close(code,reason) {
			console.log("CLose socket from client side...");
			l.worker.postMessage({ op: "close", is: socket.socket, code, reason });
		},
		cb: null,
		events_: [],
		on(event, cb, ...more) {
			if ("function" !== typeof cb) {
				if (event in this.events_) {
					const r = this.events_[event].reduce( ((acc,val)=>{
						const a = val(cb,...more)
						if( a ) if( acc ) {
							if( acc instanceof Array ) {
								acc.push( a );
								return acc;
							}else return [acc,a];
						} else return a;
					}), null );
					return r;
				}
			} else {
				if( event in this.events_ ) this.events_[event].push(cb);
				else this.events_[event] = [cb];
			}
		},
		send(a) {
			//console.log( "Send something?",a );
			l.worker.postMessage({ op: "send", id: socket.socket, msg: a });
		},
		handleMessage: null,
		handleMessageInternal(msg) {
			if ("string" === typeof msg) {
				msg = JSOX.parse(msg);
			}
			console.log("this message", typeof msg, msg.op, msg);
			if (msg.op === "addMethod") {
				try {
					const f = new AsyncFunction("JSON", "config", "idGen", "Import", msg.code);
					f.call(socket, JSOX, config, idGen, (n) => import(n)).then(() => {
						console.log("completed...");
						//socket.on("connect", socket );
						const pending = l.connects.shift();
						console.log("Pending is:", pending);
						pending.res( socket )

						socket.handleMessage = pending.cb;
						//l.logins.push(pending);

						//pending.res( this );

					});

					if ("setEventCallback" in socket)
						socket.setEventCallback(socket.on.bind(socket, "event"));

					//socket.on( "connect", socket );
				} catch (err) {
					console.log("Function compilation error:", err, "\n", msg.code);
				}

			} else if (msg.op === "status") {
				console.log("Socket doesn't have a event cb? Status:", msg.status);
			} else if (msg.op === "disconnect") {
				const socket = l.sockets.get(msg.id);
				if( socket ) {
					l.sockets.delete(msg.id);
					console.log( "THIS IS A DISCONNECT FAILURE MESSAGE");
					socket.on("disconnect");
				}else {
					console.log( "Trying to do ano operation against a closed socket..." );
				}
			} else {
				if (socket.fw_message)
					if (socket.fw_message(socket, msg)) return;
				if (msg.op === "get") {
					console.log("No service handler for get... passing back to default handler.");
					if (workerInterface.uiSocket)
						workerInterface.uiSocket.send(msg);
					//l.worker.postMessage( msg );
					return;
				}

				console.log("Recevied unknown network event:", msg);
			}
		}
	};

	return socket;
}


function handleMessage(event) {
	const msg = event.data;
	//console.log( "msg:", msg );
	if (msg.op === "a") {
		const sock = l.sockets.get(msg.id);
		if (sock) {
			sock.handleMessage(msg.msg);
		}
	} else if (msg.op === "b") {
		const sock = l.sockets.get(msg.id);
		if (sock) {
			const imsg = msg.msg;
			if (imsg.op === "disconnect") {				
				l.sockets.delete(imsg.id);
				sock.on("close", imsg.code, imsg.reason );
			}
		}
	} else {
		if (msg.op === "connecting") {
			let connect = l.connects.shift();
			const sock = makeSocket(msg.id, msg.from);
			sock.handleMessage = (msg)=>connect.onMsg(sock,msg);
			connect.res( sock );
			l.sockets.set(msg.id, sock);
		} else if (msg.op === "get") {
			l.worker.postMessage(msg);
		} else if (msg.op === "disconnect") {
			const sock = l.sockets.get(msg.id);
			console.log( "this is a normal close message" );
			sock.on( "close", msg.code, msg.reason );
			sock.handleMessage(msg);
		} else {
			console.log("Unhandled Message:", msg);
		}
	}
}

function connect(address, protocol, onMsg) {
	//console.trace( "DO CONNECT:", address );
	return new Promise((res, rej) => {
		let msg = { op: "connect", protocol: protocol, address: address }
		if (l.worker) {
			//console.log( "sending message now, and clearing" );
			l.worker.postMessage(msg);
			msg = null;
		}
		l.connects.push({ res: res, rej: rej, onMsg: onMsg, msg });
	})
}


export { workerInterface }
