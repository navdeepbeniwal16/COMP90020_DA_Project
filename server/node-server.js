const express = require('express');
const app = express();
const process = require('process');
const Blockchain = require('../blockchain/Blockchain.js');
const Block = require('../blockchain/Block.js')
const { Logger, NodeType, EventType } = require('./Logger.js');
const bodyParser = require('body-parser')
const ioClient = require('socket.io-client');

const PORT = process.argv[2]; // accessing the port provided by the user/script
const NM_HOSTNAME = "http://localhost";
const NM_PORT = process.argv[3];
if(!PORT) {
    console.log("Blockchain Node PORT not provided, please provide the network manager's PORT");
    process.exit(0);
}
if(!NM_PORT){
    console.log("Network Manager PORT not provided, please provide the network manager's PORT");
    process.exit(0);
}
const NM_URL = NM_HOSTNAME + ":" + NM_PORT;


let logManagerConnection = ioClient.connect('http://localhost:8081', { extraHeaders: { type: "publisher" }});

// Injecting Middlewares
app.use(bodyParser.json())

// creating a Blockchain instance (with just genesis block)
const blockchain = new Blockchain();

// establising a connection with the server
let networkManagerConnection = ioClient.connect(NM_URL);

const logger = new Logger(networkManagerConnection.id, NodeType.Blockchain);
let logMessage = null;
let logData = {};
logMessage = logger.createLogMessage(EventType.NetworkEventType.RegisteredBlockchainNode, `Blockchain node with id ${networkManagerConnection.id} registering onto the network`);
logManagerConnection.emit('produce-log', logMessage);

networkManagerConnection.on('pool-transaction-block', (transactionblock) => {
    console.log('Transaction block (to pool) sent by the network manager');
    console.log(transactionblock)

    logMessage = logger.createLogMessage(EventType.NodeEventType.PoolingTransactions, `Transaction is being pooled`, true);
    logManagerConnection.emit('produce-log', logMessage);

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

        logData = blockchain.getBlockchainState();
        logMessage = logger.createLogMessage(EventType.BlockchainEventType.PooledTransactions, `Transaction is pooled`, false, logData);
        logManagerConnection.emit('produce-log', logMessage);
    } catch (error) {
        console.log('Error occured while adding transaction block to the blockchain...');
        console.log(error.message);

        logMessage = logger.createLogMessage(EventType.Error, `Transaction can't be pooled`, false, logData);
        logManagerConnection.emit('produce-log', logMessage);
    }
})

networkManagerConnection.on('forge-transaction-block', () => {
    logMessage = logger.createLogMessage(EventType.NodeEventType.ForgingTransactionsBlock, `Transaction block is being forged`, true, logData);
    logManagerConnection.emit('produce-log', logMessage);

    try {
        if(blockchain.getUnverifiedTransactionsBlocksSize() == 0) {
            throw new Error('No transaction block available to be forged');
        }

        const transactionsBlock = blockchain.unverifiedTransactionsBlocks[0];
        const forgedBlock = blockchain.forgeBlock(transactionsBlock);
        blockchain.unverifiedChainBlocks.push(forgedBlock);
        blockchain.unverifiedTransactionsBlocks = []; // empting the unverified transactions pool

        networkManagerConnection.emit('forged-block', forgedBlock.toJSON());
        console.log(`Forged block on Node : ${networkManagerConnection.id} :\n ${forgedBlock.toJSON()}`);

        logData = blockchain.getBlockchainState();
        logMessage = logger.createLogMessage(EventType.BlockchainEventType.ForgedTransactionsBlock, `Transaction is forged`, false, logData);
        logManagerConnection.emit('produce-log', logMessage);
    } catch (error) {
        console.log(`Error occured while forging a block... \n${error.message}`);
        // TODO: Emit some message to Network Manager

        logMessage = logger.createLogMessage(EventType.Error, `Transaction block can't be forged`, false, logData);
        logManagerConnection.emit('produce-log', logMessage);
    }
})

networkManagerConnection.on('validate-block', (forgedBlockData) => {
    logMessage = logger.createLogMessage(EventType.NodeEventType.ValidatingBlock, `Transaction block is being validated`, true, logData);
    logManagerConnection.emit('produce-log', logMessage);

    const forgedBlockJSON = JSON.parse(JSON.stringify(forgedBlockData));
    console.log(`Forged block received on Validation Node : ${networkManagerConnection.id} :\n ${forgedBlockJSON}`); // TODO: TBR
    
    const transactionBlock = blockchain.unverifiedTransactionsBlocks[0]; // TODO: Fix problem here
    console.log('Transaction block (on validation node) :')
    console.log(transactionBlock)

    const forgedBlock = Block.createBlockFromJSON(forgedBlockJSON);
    if(blockchain.validateBlock(transactionBlock, forgedBlock)) {
        console.log(`Block with id : ${forgedBlock.id} is : Valid`);
        blockchain.unverifiedTransactionsBlocks = [];
        blockchain.unverifiedChainBlocks.push(forgedBlock);

        networkManagerConnection.emit('valid-block');
    } else {
        console.log(`Block with id : ${forgedBlock.id} is : Invalid`);
        networkManagerConnection.emit('invalid-block');
    }
})

networkManagerConnection.on('commit-block', () => {
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
    } catch (error) {
        console.log(`Error occured while commiting a block... \n${error.message}`);
    }
})

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



// TODO: API to validate the blockchain
// TODO: API to update a block (to simulate an attack i.e changing a block in the blockchain)

app.listen(PORT, () => {
    console.log('Blockchain node is running on PORT: ' + PORT);
})
