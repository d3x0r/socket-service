/**
* This is the Socket Websocket Server.  It is a hook into a sack.vfs server handler.
*/

import {sack} from "sack.vfs" ;

const disk = sack.Volume();


export function handleRequest( req, res, serverOpts ) {
	const contentType = 'text/javascript';
	let filePath = req.url;
	const npm_path = serverOpts.npmPath || ".";
	// redirect this file's source so it can serve root content.
	//console.log( "socket-service got a turn at:", req.url );
	if( req.url === '/socket-service-swbundle.js' ) filePath = npm_path+'/node_modules/@d3x0r/socket-service/swbundle.js'
	else if( req.url === '/socket-service-swbundle.js.gz' ) filePath = npm_path+'/node_modules/@d3x0r/socket-service/swbundle.js.gz'
	else if( req.url === '/socket-service-client.js' ) filePath = npm_path+'/node_modules/@d3x0r/socket-service/swc.js'
/*
	else if( req.url === '/login/webSocketClient.js' ) {
		const file = sack.HTTPS.get( {method:"GET", port:8089, path:"/ui"+req.url, hostname:"d3x0r.org" } );
		if( file.error ) {
			console.log( "REspond error:", file );
			return true;
		}
		res.writeHead(200, { 'Content-Type': contentType });
		res.end( file.content );
		return true;
	}
*/
	else return false;
	//console.log( "Url handler for socket service..", filePath );
	//const prePath = (serverOpts.npmPath || "." ) + "/";
	//filePath = prePath + filePath;
	//console.log( 'filePath? did we get serverOpts?', this, filePath );
	if( disk.exists( filePath ) ) {
		res.writeHead(200, { 'Content-Type': contentType });
		//console.log( "Read:", "." + req.url );
		res.end( disk.read( filePath ) );
		return true;
	}
	return false;
}
