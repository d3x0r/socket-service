import {SaltyRNG} from "/node_modules/@d3x0r/srg2/salty_random_generator2.mjs"
const regenerator = SaltyRNG.id;
const generator = SaltyRNG.id;
const short_generator = SaltyRNG.id;

import {JSOX} from "/node_modules/jsox/lib/jsox.mjs"

const idGen = { generator:generator,regenerator:regenerator }
const AsyncFunction = Object.getPrototypeOf( async function() {} ).constructor;

const workerInterface = {
	connect: connect,
	uiSocket:null,
	setUiLoader(protocol) {
		workerInterface.uiSocket = protocol;                    
		l.worker.postMessage( {op:"setUiLoader", socket:protocol.socket} );
	},
	expect(url) {
            	// notify worker that another page will be
            	// loaded soon, and that this client socket is also
            	// used for that.
		l.worker.postMessage( {op:"expect", url:url } );
	},
        initWorker: initWorker
}

const l = {
	requestSocket : null,
	reg : null,
	worker : null,
	connects:[],
	logins:[],
	opens:[],
	sockets :new Map(),

};

const config = {run:{ devkey:localStorage.getItem( "devkey" ),
		clientKey : localStorage.getItem( "clientKey" ),
		sessionKey : localStorage.getItem( "sessionKey" )
} };


const localStorage_ = {
	setItem(item,val) {
		localStorage.setItem( item, val );
		config.run[item] = val;
	},
	getItem(item) {
		return localStorage.getItem( item );
	},
	removeItem(item) {
		config.run[item] = null;
		localStorage.removeItem(item);
	}
}

function initWorker() {

	navigator.serviceWorker.register('/socket-service-swbundle.js', { scope: '/' }).then(function(registration) {
		// Registration was successful
		//console.log('ServiceWorker registration successful with scope: ', registration.scope, registration);
		l.reg = registration;
		//console.log( "got registration", registration );
		// poll for ready...
		tick();
        }, function(err) {
		// registration failed :(
		console.log('ServiceWorker registration failed: ', err);
	});

	function tick() {
		//console.log( "tick waiting for service...", l.worker );
            	if( !l.worker ) {
			l.worker = l.reg.active;
			if( l.worker ) {
				//console.log( "Sending hello." );
				l.worker.postMessage( {op:"Hello" } );                	
				if( l.connects.length ) 
					for( let msg of l.connects ) {
						l.worker.postMessage( msg.msg );
					}
			} else {
				//setTimeout( tick, 100 );
			}
                }


	}

	navigator.serviceWorker.ready.then( registration => {
		//console.log( "THIS IS READY?" );
		l.reg = registration;
		tick();
	});

	navigator.serviceWorker.addEventListener( "message", handleMessage );

}

class WebSocket {

	socket = null;
	from= null; // track redirect for reconnect?
	cb = null;
	handleMessage = null;
	events_ = [];

	constructor( sockid, from ) {
		this.socket = from;
		this.socket = sockid;
	}
	setUiLoader() {
		workerInterface.setUiLoader( socket );
	}
	close() {
		console.log( "CLose socket from client side..." );
		l.worker.postMessage( {op:"close", is:this.socket } );
	}
	newSocket(addr) {
		return new Promise( (res,rej)=>{
			l.opens.push( res );				
			l.worker.postMessage( addr );
		} );
	}
	on(event,cb ) {
		if( "function" !== typeof cb ) {
                     	if( event in this.events_ )
				this.events_[event](cb);
		} else {
			this.events_[event] = cb;
		}
	}
	send(a) {
		//console.log( "Send something?",a );
		l.worker.postMessage( {op:"send", id:this.socket, msg:a } );
	}
	handleMessageInternal(msg ) {
		if( "string" === typeof msg ) {
			msg = JSOX.parse( msg ) ;
		}
		console.log( "this message", typeof msg, msg.op, msg ) ;
		if( msg.op === "addMethod" ) {
                             try {
				const f = new AsyncFunction( "JSON", "config", "idGen", "Import", msg.code );
				f.call( socket, JSOX, config, idGen, (n)=>import(n) ).then( ()=>{
					console.log( "completed..." );
					//this.on("connect", socket );
					const pending = l.connects.shift();
					console.log( "Pending is:", pending );
					pending.cb( this );
					this.handleStatus = pending.cb;
					this.handleMessage = pending.onMsg;
					l.logins.push( pending );
					//pending.res( this );

				} );
	                
				if( "setEventCallback" in socket )
					this.setEventCallback( this.on.bind( socket, "event" ) );
				
				//this.on( "connect", socket );
			} catch( err ) {
				console.log( "Function compilation error:", err,"\n", msg.code );
			}		
			
		} else if( msg.op === "status" ) {
			if( this.cb )
			    this.cb( msg.status );
			else
                                 console.log( "Socket doesn't have a event cb? Status:", msg.status );
		} else if( msg.op === "disconnect" ) {
                        const socket = l.sockets.get( msg.id );
     	                l.sockets.delete( msg.id );
             	        this.on("disconnect");
		} else {
			if( this.fw_message )
				if( this.fw_message( socket, msg ) ) return;
			if( msg.op === "get" ) {
				console.log( "No service handler for get... passing back to default handler." );
				if( workerInterface.uiSocket )
					workerInterface.uithis.send( msg );
				//l.worker.postMessage( msg );
				return;
			}

			//this.cb( msg );
			console.log( "Received unknown network event:", msg );
		}
	}

}

function makeSocket( sockid, from ) {
	//console.log( "making a socket.." );
	const socket = new WebSocket( sockid, from );

	return socket;
}


function handleMessage( event ) {
	const msg = event.data;
	//console.log( "socket-service client msg:", msg );
	if( msg.op === "a" ) {		
		const sock = l.sockets.get( msg.id );
		if( sock ) {
			sock.handleMessage( sock, msg.msg );
		}
	} else if( msg.op === "b" ) {		
		const sock = l.sockets.get( msg.id );
		if( sock ) {
			//console.log( "socket state change message:", msg.msg );
			const imsg = msg.msg;
			if( imsg.op === "status" ) {
				if( sock.cb )
					sock.cb( imsg.status );
				else
					console.log( "Socket doesn't have a event cb? Status:", imsg.status );
			} else if( imsg.op === "opening" ) {
				sock.cb( "Opening..." );
				//console.log( "onopen event?" );
			} else if( imsg.op === "open" ) {
				sock.cb( "Open" );
				sock.on( "open" );
				//console.log( "onopen event?" );
			} else if( imsg.op === "disconnect" ) {
				l.sockets.delete( imsg.id );
				sock.on("disconnect");
			}
		}
	} else {
		//console.log( "worker Event", msg );
		if( msg.op === "connecting" ) {
			let connect;
			if( l.opens.length ) {
				const sock = makeSocket( msg.id );
				l.sockets.set( msg.id, sock );
				return l.opens.shift()(sock);
			} else if( l.connects.length ) {
				connect = l.connects.shift();
			}
			const sock = makeSocket(msg.id,msg.from );
			if( connect ) {
				sock.handleMessage = connect.onMsg;
				sock.cb = connect.cb
			}
			l.sockets.set( msg.id, sock );
		} else if( msg.op === "get" ) {
			l.worker.postMessage( msg );
		} else if( msg.op === "disconnect" ) {
			const sock = l.sockets.get(msg.id );
			sock.handleMessage( msg );
		} else {
			console.log( "Unhandled Message:", msg );
		}
	}
}

function connect( address, protocol, cb, onMsg ) {
	//console.trace( "DO CONNECT:", address );
	return new Promise( (res,rej)=>{
		let msg = {op:"connect", protocol:protocol, address:address }
		if( l.worker ) {
			console.log( "sending message now, and clearing" );
			l.worker.postMessage( msg ); 	
			msg = null;
		}
		l.connects.push( { cb: cb, res:res, rej:rej, onMsg:onMsg, msg } );
	} )
}


export {workerInterface }
