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
    console.log('Node Server id : ' + networkManagerConnection.id); // TODO: TBR
    logger = new Logger(networkManagerConnection.id, NodeType.Blockchain);

    logMessage = logger.createLogMessage(EventType.NetworkEventType.RegisteredBlockchainNode, `Blockchain node with id ${networkManagerConnection.id} registering onto the network`);
    logManagerConnection.emit('produce-log', logMessage);
})

function synchronizingBlockchain(blockchainArg){
    
    blockchain.unverifiedTransactionsBlocks = blockchainArg.unverifiedTransactionsBlocks;
    blockchain.unverifiedChainBlocks = blockchainArg.unverifiedChainBlocks;
    console.log("blockchain received in the blockchainArg is");
    console.log(blockchainArg);
    blockchain.chain = []
    blockchain.chain.push(new Block([],0));
    for (let nIndex = 1; nIndex < blockchainArg.chain.length; nIndex++){
        console.log("synchronizing blocks");
        console.log(blockchainArg["chain"][nIndex]);
        const block = Block.createBlockFromJSON(blockchainArg["chain"][nIndex]);
        blockchain.chain.push(block);
    }
    console.log("blockchain after synchronization is");
    console.log(blockchain);
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

    console.log("event received of send-validated-blockchain"); // TODO : TBR
    try {
        console.log("send-validation hannan checkpoint"); //TODO : TBR
        console.log(blockchain);
        if(blockchain.validateBlockchain()){
            console.log("hannan checkpoint 4"); //TODO : TBR
            console.log(blockchain);
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
        blockchain.unverifiedTransactionsBlocks = []; // empting the unverified transactions pool

        networkManagerConnection.emit('forged-block', forgedBlock.toJSON());
        console.log(`Forged block on Node : ${networkManagerConnection.id} :\n and the forged block is`);
        console.log(forgedBlock);

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

        logMessage = logger.createLogMessage(EventType.BlockchainEventType.ValidatedBlock, `Transaction block is validated`, false, blockchain.getBlockchainState());
        logManagerConnection.emit('produce-log', logMessage);
    } else {
        console.log(`Block with id : ${forgedBlock.id} is : Invalid`);
        networkManagerConnection.emit('invalid-block');

        logMessage = logger.createLogMessage(EventType.Error, `Transaction block can't be validated: ${error.message} `, false);
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

// TODO: API to validate the blockchain
// TODO: API to update a block (to simulate an attack i.e changing a block in the blockchain)

app.listen(PORT, () => {
    console.log('Blockchain node is running on PORT: ' + PORT);
})
