const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const process = require('process');
const ioServer = require('socket.io')(server, { cors : { origin : "*" }});
const bodyParser = require('body-parser');
const { workerData } = require("worker_threads");
const { Logger, NodeType, EventType } = require('./Logger.js');
const ioClient = require('socket.io-client');

// Injecting Middlewares
app.use(bodyParser.json())

let logManagerConnection = ioClient.connect('http://localhost:8081', { extraHeaders: { type: "publisher" }});

let logger = new Logger('nm', NodeType.NetworkManager);;
let logMessage = null;
let logData = {};

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
let validatorPercentage = 50;
let stakeReward = 2;
let blockchainReceived = {};
let blockchain = {};
let listValidBlockchainReceived = {};
let newNode = null;
let blockednodes = [];
let invalidvalidators = {};
let validBlockResponses =0;
let displayValidatedBlockchain = {};
let displayflag = false;
// stake generator
function stakegenerator(){
    return Math.floor(Math.random()*100);
}

// registering/deregistering a blockchain node
ioServer.on('connection', (socket) => {
    console.log(`Blockchain node with id : ${socket.id} registering with network-manager`);
    workernodes[socket.id] = {"socket":socket,"stake":stakegenerator()};
    listValidBlockchainReceived = {};
    blockchainReceived = {};
    blockchain = {};
    newNode = socket.id;
    //copying the whole blockchain to the new node
    logMessage = logger.createLogMessage(EventType.NetworkEventType.RegisteredBlockchainNode, `Blockchain node with id ${socket.id} successfully registered onto the network`, true);
    logManagerConnection.emit('produce-log', logMessage);
    for (const nodeId in workernodes){
        if (nodeId != socket.id){
            const node = workernodes[nodeId]['socket'];
            node.emit("send-validated-blockchain");
        }
    }
    
    
    

    socket.on("validated-blockchain", (validatedBlockchain) => {
        
        
        
        if("Status" in validatedBlockchain) {
            console.log("blockchain received is not valid");
            listValidBlockchainReceived[socket.id]={"Status":validatedBlockchain["Status"],"Size":0};
            logMessage = logger.createLogMessage(EventType.BlockchainEventType.ValidatedBlockchain, `Blockchain node with id ${socket.id} could not valid its own blockchain`);
            logManagerConnection.emit('produce-log', logMessage);
        }
        else {
            listValidBlockchainReceived[socket.id]={"Status":"True","Size":Object.keys(validatedBlockchain["chain"]).length};
            blockchainReceived[socket.id] = validatedBlockchain;
            logMessage = logger.createLogMessage(EventType.BlockchainEventType.ValidatedBlockchain, `Blockchain node with id ${socket.id} successfully sent its validated blockchain`, true);
            logManagerConnection.emit('produce-log', logMessage);
        }

        var validatedBlockchainReceived=0;
        for (const status in listValidBlockchainReceived){
            if(listValidBlockchainReceived[status]["Status"] == "True"){
                validatedBlockchainReceived++;
            }
        }
        
        if(newNode){
            if(Object.keys(listValidBlockchainReceived).length == Object.keys(workernodes).length-1 || validatedBlockchainReceived >=Math.floor(2/3*Object.keys(workernodes).length) ){
                logMessage = logger.createLogMessage(EventType.BlockchainEventType.ValidatedBlockchain, `Received responses from all nodes in the network`, true);
                logManagerConnection.emit('produce-log', logMessage);
                validatedBlockchainReceived=0;
                for (const status in listValidBlockchainReceived){
                    if(listValidBlockchainReceived[status]["Status"] == "True"){
                        validatedBlockchainReceived++;
                    }
                }
                if (validatedBlockchainReceived >= Math.floor(2/3*Object.keys(workernodes).length)){
                    logMessage = logger.createLogMessage(EventType.BlockchainEventType.ValidatedBlockchain, `Validated blockchain received from 2/3rd of the nodes in the network`, true);
                    logManagerConnection.emit('produce-log', logMessage);
                    var blockchainStatus = "True";
                    blockConsensus = 0;
                    logMessage = logger.createLogMessage(EventType.BlockchainEventType.ValidatedBlockchain, `Checking the received blockchains with each other`, true);
                    logManagerConnection.emit('produce-log', logMessage);
                    for( const socketIDs in blockchainReceived){
                        for (let blockindex = 0; blockindex < listValidBlockchainReceived[socketIDs]["Size"]; blockindex++){
                            for(const secondIds in blockchainReceived){
                                if (blockchainReceived[socketIDs]["chain"][blockindex]["hash"] == blockchainReceived[secondIds]["chain"][blockindex]["hash"]){

                                    blockConsensus++;
                                }
                            }
                            
                            if(blockConsensus >=Math.floor(2/3*Object.keys(workernodes).length)){
                                //console.log("block is correct"); //TODO: TBR
                            }
                            else {
                                console.log(`consensus not reached. ${socketIDs} is a faulty blockchain`);
                                blockchainStatus = "False";
                                
                            }
                            blockConsensus = 0;
                        }
                        if (blockchainStatus == "True"){
                            logMessage = logger.createLogMessage(EventType.BlockchainEventType.ValidatedBlockchain, `Blockchain node with id ${socketIDs} is selected to have globally validated blockchain by 2/3 majority consensus`, false);
                            logManagerConnection.emit('produce-log', logMessage);
                            Object.assign(blockchain, blockchainReceived[socketIDs]);
                            newNodeSocket = workernodes[newNode]["socket"];
                            logMessage = logger.createLogMessage(EventType.NodeEventType.AddValidatedBlockchain, `Validated blockchain is sent to the new node to be added`, false);
                            logManagerConnection.emit('produce-log', logMessage);
                            newNodeSocket.emit("add-validated-blockchain", blockchain);
                            logMessage = logger.createLogMessage(EventType.NodeEventType.AddValidatedBlockchain, `Blockchain node with ID; ${newNodeSocket.id} successfully updated and synchronized`, true);
                            logManagerConnection.emit('produce-log', logMessage);
                            blockchain = {};

                            
                            listValidBlockchainReceived = {};

                            blockchainReceived = {};
                            newNode = null;
                            break;
                        }
                    }
                }
            }
            else {
                logMessage = logger.createLogMessage(EventType.BlockchainEventType.ValidatedBlockchain, `Network Manager waiting for other nodes to send their blockchain status`, false);
                logManagerConnection.emit('produce-log', logMessage);
                console.log("waiting for other worker nodes to send their blockchain to be added to the new node");
            }
        }
        else if (Object.keys(invalidvalidators).length != 0){
            let remainingNodes = Object.keys(workernodes).length - Object.keys(invalidvalidators).length
            if(Object.keys(listValidBlockchainReceived).length == remainingNodes || validatedBlockchainReceived >= Math.floor(2/3*remainingNodes)){
                validatedBlockchainReceived=0;
                for (const status in listValidBlockchainReceived){
                    if(listValidBlockchainReceived[status]["Status"] == "True"){
                        validatedBlockchainReceived++;
                    }
                }
                if (validatedBlockchainReceived >= Math.floor(2/3*remainingNodes)){
                    var blockchainStatus = "True";
                    blockConsensus = 0;
                    for( const socketIDs in blockchainReceived){
                        for (let blockindex = 0; blockindex < listValidBlockchainReceived[socketIDs]["Size"]; blockindex++){
                            for(const secondIds in blockchainReceived){
                                if (blockchainReceived[socketIDs]["chain"][blockindex]["hash"] == blockchainReceived[secondIds]["chain"][blockindex]["hash"]){

                                    blockConsensus++;
                                }
                            }
                            
                            if(blockConsensus >=Math.floor(2/3*Object.keys(workernodes).length)){
                                //console.log("block is correct"); //TODO: TBR
                            }
                            else {
                                console.log(`consensus not reached. ${socketIDs} is a faulty blockchain`);
                                blockchainStatus = "False";
                                
                            }
                            blockConsensus = 0;
                        }
                        if (blockchainStatus == "True"){
                            Object.assign(blockchain, blockchainReceived[socketIDs]);
                            
                            for(nodeid in invalidvalidators){
                                invalidvalidators[nodeid].emit("add-validated-blockchain", blockchain);
                            }
                            
                            invalidvalidators = {}
                            blockchain = {};
                            listValidBlockchainReceived = {};
                            blockchainReceived = {};
                            break;
                        }
                    }
                }
            }
            else {
                console.log("waiting for other worker nodes to send their blockchain");
            }
        }
        else if (displayflag) {
            if(Object.keys(listValidBlockchainReceived).length == Object.keys(workernodes).length || validatedBlockchainReceived >=Math.floor(2/3*Object.keys(workernodes).length)){
                validatedBlockchainReceived=0;
                for (const status in listValidBlockchainReceived){
                    if(listValidBlockchainReceived[status]["Status"] == "True"){
                        validatedBlockchainReceived++;
                    }
                }
                if (validatedBlockchainReceived >= Math.floor(2/3*Object.keys(workernodes).length)){
                    var blockchainStatus = "True";
                    blockConsensus = 0;
                    for( const socketIDs in blockchainReceived){
                        for (let blockindex = 0; blockindex < listValidBlockchainReceived[socketIDs]["Size"]; blockindex++){
                            for(const secondIds in blockchainReceived){
                                if (blockchainReceived[socketIDs]["chain"][blockindex]["hash"] == blockchainReceived[secondIds]["chain"][blockindex]["hash"]){

                                    blockConsensus++;
                                }
                            }
                            
                            if(blockConsensus >=Math.floor(2/3*Object.keys(workernodes).length)){
                                //console.log("block is correct"); //TODO: TBR
                            }
                            else {
                                console.log(`consensus not reached. ${socketIDs} is a faulty blockchain`);
                                blockchainStatus = "False";
                                
                            }
                            blockConsensus = 0;
                        }
                        if (blockchainStatus == "True"){
                            console.log("hannan checkpoint 3");
                            Object.assign(displayValidatedBlockchain, blockchainReceived[socketIDs]);
                            invalidvalidators = {}
                            blockchain = {};
                            listValidBlockchainReceived = {};
                            blockchainReceived = {};
                            break;
                        }
                    }
                }
            }
            else {
                console.log("waiting for other worker nodes to send their blockchain");
            }
        }

    })
    socket.on('disconnect', () => {
        logMessage = logger.createLogMessage(EventType.NetworkEventType.DeregisteredBlockchainNode, `Blockchain node with ID: ${socket.id} deregistered from the network`, true);
        logManagerConnection.emit('produce-log', logMessage);
        console.log(`Blockchain node with id : ${socket.id} deregistering with network-manager`);
        delete workernodes[socket.id]
    });

    socket.on('forged-block', (forgedBlock) => {
        logMessage = logger.createLogMessage(EventType.NodeEventType.ForgingTransactionsBlock, `Network manager has received the forged block from ${socket.id}}`, true);
        logManagerConnection.emit('produce-log', logMessage);
        console.log(`Forged block received from the ${socket.id}`);
        console.log(forgedBlock);

        logMessage = logger.createLogMessage(EventType.NodeEventType.ValidatingBlock, `Network manager is sending the forged block to all the validators for them to validate`, true);
        logManagerConnection.emit('produce-log', logMessage);
        for(nodeId in validatorNodes) {
            const node = validatorNodes[nodeId]['socket'];    
            node.emit('validate-block', JSON.parse(JSON.stringify(forgedBlock)));
        }
    })

    socket.on('valid-block', () => {
        logMessage = logger.createLogMessage(EventType.NodeEventType.ValidatingBlock, `Validator : ${socket.id} successfully validated the block`, true);
        logManagerConnection.emit('produce-log', logMessage);
        console.log(`Blockchain node with id : ${socket.id} validated the block`);
        validationsReceived++;
        validBlockResponses++;
        //if(Object.keys(validatorNodes).length == validBlockResponses){
            if(validationsReceived >= (2/3) * Object.keys(validatorNodes).length && !isBlockValidated) {
                isBlockValidated = true;
                logMessage = logger.createLogMessage(EventType.NodeEventType.ValidatingBlock, `2/3 majority validators have successfully valided the block`, true);
                logManagerConnection.emit('produce-log', logMessage);
                const nodeIds = Object.keys(workernodes);
                logMessage = logger.createLogMessage(EventType.NodeEventType.ValidatingBlock, `Commiting the block to the blockchain`, true);
                logManagerConnection.emit('produce-log', logMessage);
                for(let nIndex=0; nIndex < nodeIds.length; nIndex++) {
                    const node = workernodes[nodeIds[nIndex]]['socket'];
                    node.emit('commit-block');
                    
                }
                if (Object.keys(invalidvalidators).length > 0){

                    correctinginvalidvalidators();
                }
            }
            else {
                logMessage = logger.createLogMessage(EventType.BlockchainEventType.CorrectiveMeasures, `2/3rd Majority rejected the block, Penalizing the Producer node : ${producerNode}`, true);
                logManagerConnection.emit('produce-log', logMessage);
                console.log("Block is not valid, Penazling Producer");
                workernodes[producerNode.id]["stake"]=workernodes[producerNode.id]['stake'] - (2*stakeReward);
                logMessage = logger.createLogMessage(EventType.BlockchainEventType.CorrectiveMeasures, `Conducting Re-election`, true);
                logManagerConnection.emit('produce-log', logMessage);
                conductElection();
                console.log("Sending to Producer Node (id) : "  + producerNode.id);
                logMessage = logger.createLogMessage(EventType.BlockchainEventType.ForgedTransactionsBlock, `Telling the Producer: ${producerNode} to forge the block`, true);
                logManagerConnection.emit('produce-log', logMessage);
                producerNode.emit('forge-transaction-block');
            }
        //}
    })

    socket.on('invalid-block', () => {
        validBlockResponses++;
        invalidvalidators[socket.id]=socket;
        //if(Object.keys(validatorNodes).length == validBlockResponses){
            if(validationsReceived >= (2/3) * Object.keys(validatorNodes).length && !isBlockValidated) {
                isBlockValidated = true;
                correctinginvalidvalidators();
                const nodeIds = Object.keys(workernodes);
                for(let nIndex=0; nIndex < nodeIds.length; nIndex++) {
                    const node = workernodes[nodeIds[nIndex]]['socket'];
                    node.emit('commit-block');
                    
                }
                if (Object.keys(invalidvalidators).length > 0){
                    correctinginvalidvalidators();
                }
            }
            else {
                logMessage = logger.createLogMessage(EventType.BlockchainEventType.CorrectiveMeasures, `2/3rd Majority rejected the block, Penalizing the Producer node : ${producerNode}`, true);
                logManagerConnection.emit('produce-log', logMessage);
                console.log("Block is not valid, Penazling Producer");
                workernodes[producerNode.id]["stake"]=workernodes[producerNode.id]['stake'] - (2*stakeReward);
                logMessage = logger.createLogMessage(EventType.BlockchainEventType.CorrectiveMeasures, `Conducting Re-election`, true);
                logManagerConnection.emit('produce-log', logMessage);
                conductElection();
                logMessage = logger.createLogMessage(EventType.BlockchainEventType.ForgedTransactionsBlock, `Telling the Producer: ${producerNode} to forge the block`, true);
                logManagerConnection.emit('produce-log', logMessage);
                console.log("Sending to Producer Node (id) : "  + producerNode.id);
                producerNode.emit('forge-transaction-block');
            }
       // }
    })
})

function getTransactionBlockLength() {
    return transactionqueue.length;
}

function correctinginvalidvalidators(){
    logMessage = logger.createLogMessage(EventType.BlockchainEventType.CorrectiveMeasures, `Initiating the corrective measures process to correct the copies of blockchain on the corrupted validators node`, true);
    logManagerConnection.emit('produce-log', logMessage);
    for (const nodeId in workernodes){
        if (!(nodeId in invalidvalidators)){
            const node = workernodes[nodeId]['socket'];
            logMessage = logger.createLogMessage(EventType.BlockchainEventType.ValidatedBlockchain, `Network Manager asking blockchain node : ${nodeId} to send its validated blockchain`, true);
            logManagerConnection.emit('produce-log', logMessage);
            node.emit("send-validated-blockchain");
        }
    }
}

function pickProducerNode(nodes) {
    const validatorNodesIds = Object.keys(nodes);
    if(validatorNodesIds.length === 0) {
        logMessage = logger.createLogMessage(EventType.NetworkEventType.RegisteredBlockchainNode, `No worker nodes registered on the system`, true);
        logManagerConnection.emit('produce-log', logMessage);
        throw new Error('No worker nodes registered on the system');
    }

    let MAX_STAKE = 0;
    let producerSocketId = null;
    logMessage = logger.createLogMessage(EventType.NetworkEventType.PickingProducerNode, `Selecting the Producer`, true);
    logManagerConnection.emit('produce-log', logMessage);
    for (const nodeId in nodes){
        if (nodes[nodeId]["stake"]>MAX_STAKE){
            MAX_STAKE = nodes[nodeId]["stake"];
            producerSocketId = nodeId;
        }
    }
    logMessage = logger.createLogMessage(EventType.NetworkEventType.PickingProducerNode, `Blockchain Node with ID: ${producerSocketId} is selected as a producer. Its stake is ${MAX_STAKE}`, true);
    logManagerConnection.emit('produce-log', logMessage);
    workernodes[producerSocketId]['stake']=workernodes[producerSocketId]['stake']+stakeReward;
    const selectedProducerNode = nodes[producerSocketId]['socket']
    delete validatorNodes[producerSocketId];
    return selectedProducerNode;
}

function pickValidatorsNodes(){
    const workerNodesCopy = {};
    Object.assign(workerNodesCopy, workernodes);
    const workerNodesIds = Object.keys(workerNodesCopy);
    const sizeOfWorkerNodes = Object.keys(workerNodesCopy).length
    const sizeOfValidatorsNodes = Math.ceil(sizeOfWorkerNodes*validatorPercentage/100);
    if(workerNodesIds.length === 0) {
        logMessage = logger.createLogMessage(EventType.NetworkEventType.RegisteredBlockchainNode, `No worker nodes registered on the system`, true);
        logManagerConnection.emit('produce-log', logMessage);
        throw new Error('No worker nodes registered on the system');
    }
    else if (sizeOfValidatorsNodes == 0){
        sizeOfValidatorsNodes = 1;
    }
    
    logMessage = logger.createLogMessage(EventType.NetworkEventType.PickingValidatorNode, `Selecting the Validator Nodes`, true);
    logManagerConnection.emit('produce-log', logMessage);
    validators = {}
    for (let i = 0; i < sizeOfValidatorsNodes; i++){
        const chosenNodeId = workerNodesIds[Math.floor(Math.random() * workerNodesIds.length)];
        logMessage = logger.createLogMessage(EventType.NetworkEventType.PickingValidatorNode, `Blockchain Node with ID: ${chosenNodeId} is selected as a validator.`, true);
        logManagerConnection.emit('produce-log', logMessage);
        validators[chosenNodeId] = workerNodesCopy[chosenNodeId];
        workerNodesIds.splice(workerNodesIds.indexOf(chosenNodeId),1);
    }
    return validators;
}

function conductElection() {
    isBlockValidated = false;
    validationsReceived = 0;
    validBlockResponses = 0;
    producerNode = null;
    validatorNodes = {};
    const workerNodesIds = Object.keys(workernodes);
    logMessage = logger.createLogMessage(EventType.NetworkEventType.ConductingElections, `Start the election process`, true);
    logManagerConnection.emit('produce-log', logMessage);
    if(workerNodesIds.length === 0) {
        logMessage = logger.createLogMessage(EventType.NetworkEventType.RegisteredBlockchainNode, `No worker nodes registered on the system`, true);
        logManagerConnection.emit('produce-log', logMessage);
        throw new Error('No worker nodes registered on the system');
    }
    validatorNodes = pickValidatorsNodes();
    producerNode = pickProducerNode(validatorNodes);

    console.log(`Producer Node : ${producerNode.id}`);
    console.log(`Validator Nodes : ${Object.keys(validatorNodes)}`);
}

function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
} 




app.get('/network/display-blockchain', async (req,res) => {
    invalidvalidators = {}
    blockchain = {};
    listValidBlockchainReceived = {};
    blockchainReceived = {};
    displayflag = true;
    for (const nodeId in workernodes){
        const node = workernodes[nodeId]['socket'];
        node.emit("send-validated-blockchain");
    }
    for (let count = 0; count <30; count++){
        await delay(1000);
        if (Object.keys(displayValidatedBlockchain).length != 0 && displayflag){
            res.send(displayValidatedBlockchain);
            displayflag = false;
            displayValidatedBlockchain = {};
            invalidvalidators = {}
            blockchain = {};
            listValidBlockchainReceived = {};
            blockchainReceived = {};
            break;
        }
    }   
});

app.get("/network/display-transactions",async (req,res) => {
    invalidvalidators = {}
    blockchain = {};
    listValidBlockchainReceived = {};
    blockchainReceived = {};
    displayflag = true;
    for (const nodeId in workernodes){
        const node = workernodes[nodeId]['socket'];
        node.emit("send-validated-blockchain");
    }
    for (let count = 0; count <30; count++){
        await delay(1000);
        if (Object.keys(displayValidatedBlockchain).length != 0 && displayflag){
            const displayTransactions = [];
            
            for (let nIndex=0; nIndex<displayValidatedBlockchain.chain.length ;nIndex++){
                parsedtransaction = JSON.parse(displayValidatedBlockchain.chain[nIndex].transactions);
                for (iIndex = 0; iIndex < parsedtransaction.length; iIndex++){
                    parsedtransaction[iIndex]["blockId"]=nIndex;
                    displayTransactions.push(parsedtransaction[iIndex]);    
                }
                
            }
            res.send(displayTransactions);
            displayflag = false;
            displayValidatedBlockchain = {};
            invalidvalidators = {}
            blockchain = {};
            listValidBlockchainReceived = {};
            blockchainReceived = {};
            break;
        }
    }
})

// Rest APIs to access the network-maasyncnager
app.get('/network/nodes', (req, res) => {
    res.send({'registeredNodes' : Object.keys(workernodes)});
});

app.post('/network/transactions', (req,res) => {
    const transaction = req.body;
    transaction.timestamp = new Date().toISOString();

    // TODO: Add transaction validations

    // adding transactions to the blockchain
    try {
        logMessage = logger.createLogMessage(EventType.BlockchainEventType.PooledTransactions, `Transactions received by the Network Manager, Pooling Transaction`, true);
        logManagerConnection.emit('produce-log', logMessage);
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
            logMessage = logger.createLogMessage(EventType.NodeEventType.PoolingTransactionsBlock, `Developing the Block of Transactions`, true);
            logManagerConnection.emit('produce-log', logMessage);
            // dequeing transaction the transactionqueue
            transactionqueue.splice(0,3);
            
            if (Object.keys(workernodes).length > 0){
                logMessage = logger.createLogMessage(EventType.NodeEventType.PoolingTransactionsBlock, `Sending the transaction blocks to the Blockchain nodes to be pooled`, true);
                logManagerConnection.emit('produce-log', logMessage);
                console.log("Sending transaction block to blockchain nodes to be pooled.");
                for(const nodeId in workernodes){
                    const node = workernodes[nodeId]['socket'];
                    logMessage = logger.createLogMessage(EventType.NodeEventType.PoolingTransactionsBlock, `Transaction block sent to ${nodeId} blockchain node`, true);
                    logManagerConnection.emit('produce-log', logMessage);
                    console.log("Sending to Node id : "  + node.id);
                    node.emit('pool-transaction-block', transactionblock)
                }  
                
                // Sending a 'forge' message to a selected producer node
                logMessage = logger.createLogMessage(EventType.NodeEventType.ForgingTransactionsBlock, `Asking the Producer Node : ${producerNode} to forge the transaction block`, true);
                logManagerConnection.emit('produce-log', logMessage);
                console.log("Sending to Producer Node (id) : "  + producerNode.id);
                producerNode.emit('forge-transaction-block');
            }
            else {
                logMessage = logger.createLogMessage(EventType.NetworkEventType.RegisteredBlockchainNode, `No worker nodes registered on the system`, true);
                logManagerConnection.emit('produce-log', logMessage);
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
