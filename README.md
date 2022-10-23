# socket-service

JS Client WorkerService which handles fetch events to get over a websocket.

Server side also needs to use this to connect events from the client to here.


## sws.js

This is service-worker-server.  This is a way to mount the built service, on a path
that is on the root of the server apparently, but lives in another place.

## swc.js (/socket-service-client.js)

This is the service-worker-client.  This is loaded on a webpage, and provides the
client side interface to the service worker.

This can be loaded from /socket-service-client.js (assuming sws has been loaded on the
server or is otherwise configured to do so).

## sw.js (swbundle.js or /socket-service-swbundle.js) 

This is the main service worker for socket services.  This is built into `swbundle.js` which
is served as `/socket-service-swbundle.js` such that it is able to catch requests for anywhere
in the domain.



## Changelog

1.0.1 
 - Update to @d3x0r/srg2.
1.0.0
 - Initial Revision