const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const process = require('process');
const ioServer = require('socket.io')(server, { cors : { origin : "*" }});
const bodyParser = require('body-parser');

// Injecting Middlewares
app.use(bodyParser.json())

transactionqueue = [];
transactionblock = [];
const PORT = process.argv[2]
if(!PORT) {
    console.log('Port number missing in the arguments...');
    process.exit(0);
}

workernodes = {};
let producerNode = null;
let validatorNodes = [];
let validationsReceived = 0;
let isBlockValidated = false;

// registering/deregistering a blockchain node
ioServer.on('connection', (socket) => {
    console.log(`Blockchain node with id : ${socket.id} registering with network-manager`);
    workernodes[socket.id] = socket;
    
    socket.on('disconnect', () => {
        console.log(`Blockchain node with id : ${socket.id} deregistering with network-manager`);
        delete workernodes[socket.id]
    });

    socket.on('forged-block', (forgedBlock) => {
        console.log(`Forged block received from the ${socket.id}`);
        console.log(forgedBlock);

        for(let nIndex=0; nIndex < validatorNodes.length; nIndex++) {
            const node = workernodes[validatorNodes[nIndex]];
            node.emit('validate-block', JSON.parse(JSON.stringify(forgedBlock)));
        }
    })

    socket.on('valid-block', () => {
        console.log(`Blockchain node with id : ${socket.id} validated the block`);
        validationsReceived++;

        if(validationsReceived >= (2/3) * validatorNodes.length && !isBlockValidated) {
            isBlockValidated = true;
            const nodeIds = Object.keys(workernodes);
            for(let nIndex=0; nIndex < nodeIds.length; nIndex++) {
                const node = workernodes[nodeIds[nIndex]];
                node.emit('commit-block');
            }
        }
    })
})

function getTransactionBlockLength() {
    console.log(`${transactionqueue.length}`);
    return transactionqueue.length;
}

function conductElection() {
    const workerNodesIds = Object.keys(workernodes);
    if(workerNodesIds.length === 0) {
        throw new Error('No worker nodes registered on the system');
    }
    
    const chosenNodeId = workerNodesIds[Math.floor(Math.random() * workerNodesIds.length)];
    producerNode = workernodes[chosenNodeId]

    validatorNodes = [];
    for(let nIndex=0; nIndex < workerNodesIds.length; nIndex++) {
        if(workerNodesIds[nIndex] !== chosenNodeId) {
            validatorNodes.push(workerNodesIds[nIndex]);
        }
    }
}

// Rest APIs to access the network-manager
app.get('/network/nodes', (req, res) => {
    res.send({'registeredNodes' : Object.keys(workernodes)});
});

app.post('/network/transactions', (req,res) => {
    const transaction = req.body;
    transaction.timestamp = new Date().toISOString();

    // TODO: Add transaction validations

    // adding transactions to the blockchain
    try {
        transactionqueue.push(transaction);
        if (getTransactionBlockLength() >= 3){
            // conduct election before sending out the data to the blocks
            conductElection();

            //send to the node-server
            
            // creating a transaction block
            const transactionblock = {
                'transactions' : transactionqueue.slice(0,3),
                'timestamp' : new Date().toISOString()
            }

            // dequeing transaction the transactionqueue
            transactionqueue.splice(0,3);
            
            if (Object.keys(workernodes).length > 0){
                console.log("Sending transaction block to blockchain nodes to be pooled.");
                for(const nodeId in workernodes){
                    const node = workernodes[nodeId];
                    console.log("Sending to Node id : "  + node.id);
                    node.emit('pool-transaction-block', transactionblock)
                }  
                
                // Sending a 'forge' message to a selected producer node
                console.log("Sending to Producer Node (id) : "  + producerNode.id);
                producerNode.emit('forge-transaction-block');
            }
            else {
                console.log("no workers nodes registered with the network manager");
                return res.status(500).send();
            }

            res.send(transactionblock);
        }
        return res.status(201).send();
    } catch (error) {
        return res.status(500).send();
    }
})

server.listen(PORT, () => {
    console.log('Network manager is running on PORT: ' + PORT);
})
