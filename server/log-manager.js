const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const process = require('process');
const logManagerServerSocket = require('socket.io')(server, { cors : { origin : "*" }});

const publisherNodes = {};
const subscriberNodes = {};

const messages = [];

function attachPublisherEventListeners(socket) {
    socket.on('produce-log', (receivedLogMessage) => {
        const logDataJSONString = JSON.stringify(receivedLogMessage);
        console.log(`Log message received from node ${socket.id}`);
        console.log(`Message : ${logDataJSONString}`);

        messages.push(receivedLogMessage);

        // forwarding the message to the subscriber
        for(const subSocketId in subscriberNodes) {
            const subSocket = subscriberNodes[subSocketId];
            subSocket.emit('log-send', receivedLogMessage);
            console.log(`Log message forwarded to node ${subSocket.id}`);
            console.log(`Message : ${logDataJSON}`);
        }
    })
}

logManagerServerSocket.on('connection', (socket) => {
    console.log('Socket handshake data : ' + JSON.stringify(socket.handshake));
    if(socket.handshake.headers.type === 'publisher') {
        console.log(`Socket request recieved from publishing node ${socket.id}`);
        publisherNodes[socket.id] = socket;
        attachPublisherEventListeners(socket);
    } else if (socket.handshake.headers.type === 'subscriber') {
        console.log(`Socket request recieved from subscribing node ${socket.id}`);
        subscriberNodes[socket.id] = socket;
    } else {
        console.log(`Socket request received from an unknown type node ${socket.id}`);
    }
})

const PORT = process.argv[2]
if(!PORT) {
    console.log('Port number missing in the arguments...');
    process.exit(0);
}

server.listen(PORT, () => {
    console.log('Log manager is running on PORT: ' + PORT);
})