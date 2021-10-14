
import {sack} from "sack.vfs" ;

const disk = sack.Volume();


export function handleRequest( req ) {
	let filePath = req.url;
	if( req.url === '/socket-service-swbundle.js' ) filePath = 'node_modules/@d3x0r/socket-service/swbundle.js'
	else if( req.url === '/socket-service-client.js' ) filePath = 'node_modules/@d3x0r/socket-service/swc.js'
	else return false;
       	contentType = 'text/javascript';

	if( disk.exists( filePath ) ) {
		res.writeHead(200, { 'Content-Type': contentType });
		//console.log( "Read:", "." + req.url );
		res.end( disk.read( filePath ) );
                return true;
	}
        return false;
}
