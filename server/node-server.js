const express = require('express');
const app = express();
const process = require('process');
const Blockchain = require('../blockchain/Blockchain.js');
const Block = require('../blockchain/Block.js')
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

// Injecting Middlewares
app.use(bodyParser.json())

// creating a Blockchain instance (with just genesis block)
const blockchain = new Blockchain();

// establising a connection with the server
let networkManagerConnection = ioClient.connect(NM_URL, () => {
    console.log('Connection with network manager is established');
});

networkManagerConnection.on('pool-transaction-block', (transactionblock) => {
    console.log('Transaction block (to pool) sent by the network manager');
    console.log(transactionblock)

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
    } catch (error) {
        console.log('Error occured while adding transaction block to the blockchain...');
        console.log(error.message);
    }
})

networkManagerConnection.on('forge-transaction-block', () => {
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
    } catch (error) {
        console.log(`Error occured while forging a block... \n${error.message}`);
        // TODO: Emit some message to Network Manager
    }
})

networkManagerConnection.on('validate-block', (forgedBlockData) => {
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
    const blockToCommit = blockchain.unverifiedChainBlocks[0];
    try {
        blockchain.commitBlock(blockToCommit);
        blockchain.unverifiedChainBlocks = [];
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
