const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const process = require('process');
const ioServer = require('socket.io')(server, { cors : { origin : "*" }});
const bodyParser = require('body-parser');
const { workerData } = require("worker_threads");

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
let validatorPercentage = 50;
let stakeReward = 2;
let blockchainReceived = {};
let blockchain = {};
let listValidBlockchainReceived = {};
let newNode = null;
let blockednodes = [];
let invalidvalidators = {};
let validBlockResponses =0;
// stake generator
function stakegenerator(){
    return Math.floor(Math.random()*100);
}
// registering/deregistering a blockchain node
ioServer.on('connection', (socket) => {
    console.log(`Blockchain node with id : ${socket.id} registering with network-manager`);
    workernodes[socket.id] = {"socket":socket,"stake":stakegenerator()};
    newNode = socket.id;
    //copying the whole blockchain to the new node
    
    
    for (const nodeId in workernodes){
        if (nodeId != socket.id){
            const node = workernodes[nodeId]['socket'];
            node.emit("send-validated-blockchain");
        }
    }
    
    
    

    socket.on("validated-blockchain", (validatedBlockchain) => {
        console.log("validatedblockchain is "); //TODO: TBR
        console.log(validatedBlockchain); //TODO: TBR
        
        if("Status" in validatedBlockchain) {
            console.log("blockchain received is not valid");
            listValidBlockchainReceived[socket.id]={"Status":validatedBlockchain["Status"],"Size":0};
        }
        else {
            listValidBlockchainReceived[socket.id]={"Status":"True","Size":Object.keys(validatedBlockchain["chain"]).length};
            blockchainReceived[socket.id] = validatedBlockchain;
        }
        
        if(newNode){
            if(Object.keys(listValidBlockchainReceived).length == Object.keys(workernodes).length-1){
                var validatedBlockchainReceived=0;
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
                                console.log("block is correct"); //TODO: TBR
                            }
                            else {
                                console.log(`consensus not reached. ${socketIDs} is a faulty blockchain`);
                                blockchainStatus = "False";
                                
                            }
                            blockConsensus = 0;
                        }
                        if (blockchainStatus == "True"){
                            console.log("hannan checkpoint 3"); //TODO : TBR
                            console.log(blockchainReceived[socketIDs]);
                            Object.assign(blockchain, blockchainReceived[socketIDs]);
                            console.log("blockchain is correct"); //TODO : TBR
                            console.log("validated blockchain after validation is"); //TODO : TBR
                            console.log(blockchain); //TODO: TBR
                            console.log("hannan checkpoint before workernodes[newNode]['socket']");
                            console.log(newNode);
                            newNodeSocket = workernodes[newNode]["socket"];
                            newNodeSocket.emit("add-validated-blockchain", blockchain);
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
                console.log("waiting for other worker nodes to send their blockchain");
            }
        }
        else if (Object.keys(invalidvalidators).length != 0){
            let remainingNodes = Object.keys(workernodes).length - Object.keys(invalidvalidators).length
            if(Object.keys(listValidBlockchainReceived).length == remainingNodes){
                var validatedBlockchainReceived=0;
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
                                console.log("block is correct"); //TODO: TBR
                            }
                            else {
                                console.log(`consensus not reached. ${socketIDs} is a faulty blockchain`);
                                blockchainStatus = "False";
                                
                            }
                            blockConsensus = 0;
                        }
                        if (blockchainStatus == "True"){
                            console.log("hannan checkpoint 3"); //TODO : TBR
                            console.log(blockchainReceived[socketIDs]);
                            Object.assign(blockchain, blockchainReceived[socketIDs]);
                            console.log("blockchain is correct"); //TODO : TBR
                            console.log("validated blockchain after validation is"); //TODO : TBR
                            console.log(blockchain); //TODO: TBR
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

    })
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
        validBlockResponses++;
        if(Object.keys(validatorNodes).length == validBlockResponses){
            if(validationsReceived >= (2/3) * Object.keys(validatorNodes).length && !isBlockValidated) {
                isBlockValidated = true;
                correctinginvalidvalidators();
                console.log("checking valid-block listener hannan checkpoint"); //TODO : TBR
                const nodeIds = Object.keys(workernodes);
                for(let nIndex=0; nIndex < nodeIds.length; nIndex++) {
                    const node = workernodes[nodeIds[nIndex]]['socket'];
                    node.emit('commit-block');
                    
                }
            }
            else {
                console.log("Block is not valid, Penazling Producer");
                workernodes[producerNode]["stake"]=workernodes[producerNode]['stake'] - (2*stakeReward);
                conductElection();
                console.log("Sending to Producer Node (id) : "  + producerNode.id);
                producerNode.emit('forge-transaction-block');
            }
        }
    })

    socket.on('invalid-block', () => {
        validBlockResponses++;
        invalidvalidators[socket.id]=socket;
        if(Object.keys(validatorNodes).length == validBlockResponses){
            if(validationsReceived >= (2/3) * Object.keys(validatorNodes).length && !isBlockValidated) {
                isBlockValidated = true;
                correctinginvalidvalidators();
                console.log("checking valid-block listener hannan checkpoint"); //TODO : TBR
                const nodeIds = Object.keys(workernodes);
                for(let nIndex=0; nIndex < nodeIds.length; nIndex++) {
                    const node = workernodes[nodeIds[nIndex]]['socket'];
                    node.emit('commit-block');
                    
                }
            }
            else {
                console.log("Block is not valid, Penazling Producer");
                workernodes[producerNode]["stake"]=workernodes[producerNode]['stake'] - (2*stakeReward);
                conductElection();
                console.log("Sending to Producer Node (id) : "  + producerNode.id);
                producerNode.emit('forge-transaction-block');
            }
        }
    })
})

function getTransactionBlockLength() {
    console.log(`${transactionqueue.length}`);
    return transactionqueue.length;
}

function correctinginvalidvalidators(){

    for (const nodeId in workernodes){
        if (!(nodeId in invalidvalidators)){
            const node = workernodes[nodeId]['socket'];
            node.emit("send-validated-blockchain");
        }
    }
}

function pickProducerNode(nodes) {
    const validatorNodesIds = Object.keys(nodes);
    if(validatorNodesIds.length === 0) {
        throw new Error('No worker nodes registered on the system');
    }
    console.log('Checkpoint 3'); // TODO: TBR
    let MAX_STAKE = 0;
    let producerSocketId = null;
    for (const nodeId in nodes){
        if (nodes[nodeId]["stake"]>MAX_STAKE){
            MAX_STAKE = nodes[nodeId]["stake"];
            producerSocketId = nodeId;
        }
    }
    console.log('Checkpoint 4'); // TODO: TBR
    //const chosenNodeId = workerNodesIds[Math.floor(Math.random() * workerNodesIds.length)];
    workernodes[producerSocketId]['stake']=workernodes[producerSocketId]['stake']+stakeReward;
    const selectedProducerNode = nodes[producerSocketId]['socket']
    delete validatorNodes[producerSocketId];
    return selectedProducerNode;
}

function pickValidatorsNodes(){
    const workerNodesCopy = {};
    Object.assign(workerNodesCopy, workernodes);
    console.log("workerndoesCopy after copying the workernodes"); //TODO: TBR
    console.log(Object.keys(workerNodesCopy)); //TODO: TBR
    const workerNodesIds = Object.keys(workerNodesCopy);
    const sizeOfWorkerNodes = Object.keys(workerNodesCopy).length
    const sizeOfValidatorsNodes = Math.ceil(sizeOfWorkerNodes*validatorPercentage/100);
    if(workerNodesIds.length === 0) {
        throw new Error('No worker nodes registered on the system');
    }
    else if (sizeOfValidatorsNodes == 0){
        sizeOfValidatorsNodes = 1;
    }
    
    console.log("this is the else statement of the validator function"); //TODO : TBR
        
    validators = {}
    for (let i = 0; i < sizeOfValidatorsNodes; i++){
        console.log("worker nodes ids are");
        console.log(workerNodesIds);
        const chosenNodeId = workerNodesIds[Math.floor(Math.random() * workerNodesIds.length)]
        console.log("chosen node id is");
        console.log(chosenNodeId);
        validators[chosenNodeId] = workerNodesCopy[chosenNodeId];
        workerNodesIds.splice(workerNodesIds.indexOf(chosenNodeId),1);
    }
    console.log('Check point!') // TODO: TBR
    console.log("chosen validators are"); //TODO: TBR
    console.log(Object.keys(validators)); //TODO: TBR
    return validators;
}

function conductElection() {
    isBlockValidated = false;
    validationsReceived = 0;
    validBlockResponses = 0;
    producerNode = null;
    validatorNodes = {};
    const workerNodesIds = Object.keys(workernodes);
    if(workerNodesIds.length === 0) {
        throw new Error('No worker nodes registered on the system');
    }
    
    //const chosenNodeId = workerNodesIds[Math.floor(Math.random() * workerNodesIds.length)];
    console.log("workers nodes before conducting the elections are:"); //TOTO: TBR
    console.log(Object.keys(workernodes)); // TODO: TBR
    validatorNodes = pickValidatorsNodes();
    console.log('Checkpoint 2!'); // TODO: TBR
    producerNode = pickProducerNode(validatorNodes);

    console.log(`Producer Node : ${producerNode.id}`);
    console.log(`Validator Nodes : ${Object.keys(validatorNodes)}`);

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
