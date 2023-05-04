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
let validatorNodes = {};
let validationsReceived = 0;
let isBlockValidated = false;
let validatorPercentage = 10;
let stakeReward = 2;

// stake generator
function stakegenerator(){
    return Math.floor(Math.random()*100);
}
// registering/deregistering a blockchain node
ioServer.on('connection', (socket) => {
    console.log(`Blockchain node with id : ${socket.id} registering with network-manager`);
    workernodes[socket.id] = {"socket":socket,"stake":stakegenerator()};
    
    socket.on('disconnect', () => {
        console.log(`Blockchain node with id : ${socket.id} deregistering with network-manager`);
        delete workernodes[socket.id]
    });

    socket.on('forged-block', (forgedBlock) => {
        console.log(`Forged block received from the ${socket.id}`);
        console.log(forgedBlock);

        for(nodeId in validatorNodes) {
            const node = validatorNodes[nodeId]['socket'];
            node.emit('validate-block', JSON.parse(JSON.stringify(forgedBlock)));
        }
    })

    socket.on('valid-block', () => {
        console.log(`Blockchain node with id : ${socket.id} validated the block`);
        validationsReceived++;

        if(validationsReceived >= (2/3) * Object.keys(validatorNodes).length && !isBlockValidated) {
            isBlockValidated = true;
            const nodeIds = Object.keys(workernodes);
            for(let nIndex=0; nIndex < nodeIds.length; nIndex++) {
                const node = workernodes[nodeIds[nIndex]]['socket'];
                node.emit('commit-block');
            }
        }
    })
})

function getTransactionBlockLength() {
    console.log(`${transactionqueue.length}`);
    return transactionqueue.length;
}

function pickProducerNode(validatorsArg) {
    const validatorNodesIds = Object.keys(validatorsArg);
    if(workerNodesIds.length === 0) {
        throw new Error('No worker nodes registered on the system');
    }
    MaxStake = 0;
    var producerSocket = null;
    for (nodesockets in validatorsArg){
        if (validatorsArg[nodesockets]["stake"]>MaxStake){
            MaxStake = validatorsArg[nodesockets]["stake"];
            producerSocket = nodesockets;
        }
    }
    //const chosenNodeId = workerNodesIds[Math.floor(Math.random() * workerNodesIds.length)];
    workernodes[ProducerSocket]['stake']=workernodes[ProducerNode]['stake']+stakeReward;
    return validatorsArg[producerSocket]['socket'];
}

function pickValidatorsNodes(){
    const workerNodesCopy = {};
    Object.assign(workerNodesCopy, workernodes);
    const workerNodesIds = Object.keys(workerNodesCopy);
    const sizeOfWorkerNodes = Object.keys(workerNodesCopy).length
    const sizeOfValidatorsNodes = Math.ceil(sizeOfWorkerNodes*validatorPercentage/100);
    if(workerNodesIds.length === 0) {
        throw new Error('No worker nodes registered on the system');
    }
    else if (sizeOfValidatorsNodes == 0){
        sizeOfValidatorsNodes = 1;
    }
    
    console.log("this is the else statement of the validator function");
        
    validators = {}
    for (let i = 0; i < sizeOfValidatorsNodes; i++){
        const chosenNodeId = workerNodesIds[Math.floor(Math.random() * workerNodesIds.length)]
        validators[chosenNodeId] = workerNodesCopy[chosenNodeId];
        workerNodesIds.splice(chosenNodeId,1);
    }
    
    return validators;
}

function conductElection() {
    const workerNodesIds = Object.keys(workernodes);
    if(workerNodesIds.length === 0) {
        throw new Error('No worker nodes registered on the system');
    }
    
    //const chosenNodeId = workerNodesIds[Math.floor(Math.random() * workerNodesIds.length)];
    validatorNodes = pickValidatorsNodes();
    producerNode = pickProducerNode(validatorNodes);

    /*
    for(let nIndex=0; nIndex < workerNodesIds.length; nIndex++) {
        if(workerNodesIds[nIndex] !== chosenNodeId) {
            validatorNodes.push(workerNodesIds[nIndex]);
        }
    }
    */
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
                    const node = workernodes[nodeId]['socket'];
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
