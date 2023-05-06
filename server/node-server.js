const express = require('express');
const app = express();
const process = require('process');
const Blockchain = require('../blockchain/Blockchain.js');
const Block = require('../blockchain/Block.js')
const { Logger, NodeType, EventType } = require('./Logger.js');
const bodyParser = require('body-parser')
const ioClient = require('socket.io-client');

const PORT = process.argv[2]; // accessing the port provided by the user/script
if(!PORT) {
    console.log("Blockchain Node PORT not provided, please provide the network manager's PORT");
    process.exit(0);
}

const NM_HOSTNAME = "http://localhost";
const NM_PORT = process.argv[3];
if(!NM_PORT){
    console.log("Network Manager PORT not provided, please provide the network manager's PORT");
    process.exit(0);
}
const NM_URL = NM_HOSTNAME + ":" + NM_PORT;

// creating a socket connection with the log manager
let logManagerConnection = ioClient.connect('http://localhost:8081', { extraHeaders: { type: "publisher" }});

// Injecting Middlewares
app.use(bodyParser.json())

// creating a Blockchain instance (with just genesis block)
const blockchain = new Blockchain();

let logger = null;
let logMessage = null;
let logData = {};

// establising a connection with the server
let networkManagerConnection = ioClient.connect(NM_URL);
networkManagerConnection.on('connect', () => {
    logger = new Logger(networkManagerConnection.id, NodeType.Blockchain);

    logMessage = logger.createLogMessage(EventType.NetworkEventType.RegisteredBlockchainNode, `Blockchain node with id ${networkManagerConnection.id} registering onto the network`);
    logManagerConnection.emit('produce-log', logMessage);
})

function synchronizingBlockchain(blockchainArg){
    
    blockchain.unverifiedTransactionsBlocks = blockchainArg.unverifiedTransactionsBlocks;
    blockchain.unverifiedChainBlocks = blockchainArg.unverifiedChainBlocks;
    
    blockchain.chain = []
    blockchain.chain.push(new Block([],0));
    for (let nIndex = 1; nIndex < blockchainArg.chain.length; nIndex++){
        
        const block = Block.createBlockFromJSON(blockchainArg["chain"][nIndex]);
        blockchain.chain.push(block);
    }
    //console.log("blockchain after synchronization is");
    //console.log(blockchain);
}

networkManagerConnection.on('pool-transaction-block', (transactionblock) => {
    logMessage = logger.createLogMessage(EventType.NodeEventType.PoolingTransactions, `Transactions are being pooled`, true);
    logManagerConnection.emit('produce-log', logMessage);

    console.log('Transaction block (to pool) sent by the network manager');
    console.log(transactionblock);

    // adding transactions to the blockchain
    try {
        const transactions = transactionblock.transactions;
        
        // Validating blockchain
        blockchain.validateBlockchain();

        // Validating the transactions
        blockchain.validateTransactions(transactions);

        // Pooling transaction block to forge later
        blockchain.poolUnverifiedTransactionsBlocks(transactionblock);
        console.log('Transaction block added to the unverified transactions chain...');
        console.log(`Current unverified transaction blocks size : ${blockchain.getUnverifiedTransactionsBlocksSize()}`);

        logMessage = logger.createLogMessage(EventType.BlockchainEventType.PooledTransactions, `Transaction is pooled`, false, blockchain.getBlockchainState());
        logManagerConnection.emit('produce-log', logMessage);
    } catch (error) {
        console.log('Error occured while adding transaction block to the blockchain...');
        console.log(error.message);

        logMessage = logger.createLogMessage(EventType.Error, `Transaction can't be pooled: ${error.message}`, false, logData);
        logManagerConnection.emit('produce-log', logMessage);
    }
})

networkManagerConnection.on("send-validated-blockchain",() => {
    logMessage = logger.createLogMessage(EventType.NodeEventType.SendingValidatedBlockchain, `Sending a valid copy of the chain`, true);
    logManagerConnection.emit('produce-log', logMessage);

    try {
        if(blockchain.validateBlockchain()){
            networkManagerConnection.emit("validated-blockchain",blockchain);

            logMessage = logger.createLogMessage(EventType.BlockchainEventType.SendValidatedBlockchain, `Validated blockchain is sent`, false, blockchain.getBlockchainState());
            logManagerConnection.emit('produce-log', logMessage);
        }
        else{
            networkManagerConnection.emit("validated-blockchain",{"Status":"False"});
            throw new Error('Blockchain is found to be invalid');
        }
    }
    catch (error) {
        console.log("Error occurred while sending the validating blockchain");
        console.log(error)

        logMessage = logger.createLogMessage(EventType.Error, `Validated blockchain can\'t be sent: ${error.message}`, false);
        logManagerConnection.emit('produce-log', logMessage);
    }
})

networkManagerConnection.on("add-validated-blockchain", (validatedBlockchain) => {
    logMessage = logger.createLogMessage(EventType.NodeEventType.AddingValidatedBlockchain, `Replacing current node with a validated copy of the blockchain`, true);
    logManagerConnection.emit('produce-log', logMessage);

    synchronizingBlockchain(validatedBlockchain);
    console.log("blockchain synchronized");

    logMessage = logger.createLogMessage(EventType.BlockchainEventType.SendValidatedBlockchain, `Validated blockchain is sent`, false, blockchain.getBlockchainState());
    logManagerConnection.emit('produce-log', logMessage);    
})

networkManagerConnection.on('forge-transaction-block', () => {
    logMessage = logger.createLogMessage(EventType.NodeEventType.ForgingTransactionsBlock, `Transaction block is being forged`, true);
    logManagerConnection.emit('produce-log', logMessage);

    try {
        if(blockchain.getUnverifiedTransactionsBlocksSize() == 0) {
            throw new Error('No transaction block available to be forged');
        }

        const transactionsBlock = blockchain.unverifiedTransactionsBlocks[0];
        const forgedBlock = blockchain.forgeBlock(transactionsBlock);
        blockchain.unverifiedChainBlocks.push(forgedBlock);
        //blockchain.unverifiedTransactionsBlocks = []; // empting the unverified transactions pool

        networkManagerConnection.emit('forged-block', forgedBlock.toJSON());


        logMessage = logger.createLogMessage(EventType.BlockchainEventType.ForgedTransactionsBlock, `Transaction is forged`, false, blockchain.getBlockchainState());
        logManagerConnection.emit('produce-log', logMessage);
    } catch (error) {
        console.log(`Error occured while forging a block... \n${error.message}`);
        // TODO: Emit some message to Network Manager

        logMessage = logger.createLogMessage(EventType.Error, `Transaction block can't be forged: ${error.message} `, false);
        logManagerConnection.emit('produce-log', logMessage);
    }
})

networkManagerConnection.on('validate-block', (forgedBlockData) => {
    logMessage = logger.createLogMessage(EventType.NodeEventType.ValidatingBlock, `Transaction block is being validated`, true);
    logManagerConnection.emit('produce-log', logMessage);

    const forgedBlockJSON = JSON.parse(JSON.stringify(forgedBlockData));
    console.log(`Forged block received on Validation Node : ${networkManagerConnection.id} :\n`); // TODO: TBR
    
    const transactionBlock = blockchain.unverifiedTransactionsBlocks[0]; // TODO: Fix problem here
    

    const forgedBlock = Block.createBlockFromJSON(forgedBlockJSON);
    if(blockchain.validateBlock(transactionBlock, forgedBlock)) {
        console.log(`Block with id : ${forgedBlock.id} is : Valid`);
        blockchain.unverifiedTransactionsBlocks = [];
        blockchain.unverifiedChainBlocks.push(forgedBlock);

        networkManagerConnection.emit('valid-block');

        logMessage = logger.createLogMessage(EventType.BlockchainEventType.ValidatedBlock, `Transaction block is validated`, false, blockchain.getBlockchainState());
        logManagerConnection.emit('produce-log', logMessage);
    } else {
        console.log(`Block with id : ${forgedBlock.id} is : Invalid`);
        networkManagerConnection.emit('invalid-block');

        logMessage = logger.createLogMessage(EventType.Error, `Transaction block is invalid `, false);
        logManagerConnection.emit('produce-log', logMessage);
    }
})

networkManagerConnection.on('commit-block', () => {
    logMessage = logger.createLogMessage(EventType.NodeEventType.CommittingBlock, `Transaction block is being committed`, true);
    logManagerConnection.emit('produce-log', logMessage);

    console.log(`Commit message received by Node ${networkManagerConnection.id}`);
    let blockToCommit = null;
    
    if(blockchain.unverifiedChainBlocks.length > 0) {
        blockToCommit = blockchain.unverifiedChainBlocks[0];
    } else {
        const  transactionsBlock = blockchain.unverifiedTransactionsBlocks[0];
        blockToCommit = blockchain.forgeBlock(transactionsBlock);
    }

    try {
        blockchain.commitBlock(blockToCommit);
        blockchain.unverifiedChainBlocks = [];
        blockchain.unverifiedTransactionsBlocks = [];
        console.log(`Node ${networkManagerConnection.id} commited block with id : ${blockToCommit.id}`);

        logMessage = logger.createLogMessage(EventType.BlockchainEventType.CommittedBlock, `Transaction block is committed`, false, blockchain.getBlockchainState());
        logManagerConnection.emit('produce-log', logMessage);
    } catch (error) {
        console.log(`Error occured while commiting a block... \n${error.message}`);

        logMessage = logger.createLogMessage(EventType.Error, `Transaction block can't be committed: ${error.message} `, false);
        logManagerConnection.emit('produce-log', logMessage);
    }
})

function recomputetransactions(blocknumber, changedTransaction){
    blockchain.chain[blocknumber-1].transactions[0]=changedTransaction
    blockchain.chain[blocknumber-1]=new Block(blockchain.chain[blocknumber-1].transactions, blockchain.chain[blocknumber-1].previousHash, blockchain.chain[blocknumber-1].timestamp,blockchain.chain[blocknumber-1].nonce);
    for (let nIndex = blocknumber; nIndex < blockchain.chain.length; nIndex++){
        blockchain.chain[nIndex]= new Block(blockchain.chain[nIndex].transactions, blockchain.chain[nIndex-1].hash, blockchain.chain[nIndex].timestamp,blockchain.chain[nIndex].nonce);    
    }
}
function recomputeblocks(blocknumber, previousHash, hash){
    let setprevioushash;
    let sethash;

    if(previousHash != null && hash == null){
            blockchain.chain[blocknumber-1]= new Block(blockchain.chain[blocknumber-1].transactions, previousHash, blockchain.chain[blocknumber-1].timestamp,blockchain.chain[blocknumber-1].nonce);
    }
    
    else if(previousHash == null && hash != null){
            blockchain.chain[blocknumber-1].hash = hash;
    }
    else if(previousHash !=null && hash != null){
        blockchain.chain[blocknumber-1].hash = hash;
        blockchain.chain[blocknumber-1].previousHash = previousHash;
    }

    for (let nIndex = blocknumber; nIndex < blockchain.chain.length; nIndex++){
        blockchain.chain[nIndex]= new Block(blockchain.chain[nIndex].transactions, blockchain.chain[nIndex-1].hash, blockchain.chain[nIndex].timestamp,blockchain.chain[nIndex].nonce);    
    }
    if(hash != null){
        blockchain.chain[blocknumber-1].hash = hash;
    }

}

/*
=================================                           REST ENDPOINTS                           =================================                 
*/
// GET api to return the current state of the blockchain
app.get('/blockchain/blocks', (req, res) => {
    res.json(blockchain.getBlocks());
})

// POST api to add a transaction block to the chain for the current node
// NOTE: API only used for testing purpose
app.post('/blockchain/transaction-blocks', (req,res) => {
    const body = req.body;
    const transactions = body.transactions;
    const timestamp = body.timestamp;

    // TODO: Add transaction validations

    // adding transactions to the blockchain
    try {
        blockchain.addBlock(transactions, timestamp);
        return res.status(201).send();
    } catch (error) {
        return res.status(500).send();
    }
})

app.post('/test/changing-blocks', (req,res) => {
    const body = req.body;
    const blockNumber = body.blockNumber;
    const previousHash = body.previousHash;
    const hash = body.hash;

    try {
        if(blockNumber == null){
            console.log("Please provide the blocknumber");
        }
        else{
            recomputeblocks(blockNumber, previousHash, hash);
        }
        return res.status(201).send();
    }
    catch (error){
        console.log(error);
        return res.status(500).send();
    }

})

app.post('/test/changing-transactions', (req,res) => {
    const body = req.body;
    const blockNumber = body.blockNumber;
    const changedTransaction = body.transaction;
    try {
        if(blockNumber == null){
            console.log("Please provide the blocknumber");
        }
        else if(changedTransaction == null){
            console.log("please provide the transaction to be changed")
        }
        else{
            recomputetransactions(blockNumber, changedTransaction);
        }
        return res.status(201).send();
    }
    catch (error){
        console.log(error);
        return res.status(500).send();
    }
    
})

// TODO: API to validate the blockchain
// TODO: API to update a block (to simulate an attack i.e changing a block in the blockchain)

app.listen(PORT, () => {
    console.log('Blockchain node is running on PORT: ' + PORT);
})
