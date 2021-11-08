
import {sack} from "sack.vfs" ;

const disk = sack.Volume();


export function handleRequest( req, res ) {
       	const contentType = 'text/javascript';
	let filePath = req.url;
	// redirect this file's source so it can serve root content.
	if( req.url === '/socket-service-swbundle.js' ) filePath = 'node_modules/@d3x0r/socket-service/swbundle.js'
	else if( req.url === '/socket-service-client.js' ) filePath = 'node_modules/@d3x0r/socket-service/swc.js'
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

	if( disk.exists( filePath ) ) {
		res.writeHead(200, { 'Content-Type': contentType });
		//console.log( "Read:", "." + req.url );
		res.end( disk.read( filePath ) );
                return true;
	}
        return false;
}
