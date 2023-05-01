const express = require('express');
const app = express();
const process = require('process');
const Block = require('../blockchain/Block.js');
const Blockchain = require('../blockchain/Blockchain.js');
const bodyParser = require('body-parser')

const PORT = process.argv[2] // accessing the port provided by the user/script
if(!PORT) {
    console.log('Port number missing in the arguments...');
    process.exit(0);
}

app.use(bodyParser.json())

// creating a Blockchain instance (with just genesis block)
const blockchain = new Blockchain();

// GET api to return the current state of the blockchain
app.get('/blockchain', (req, res) => {
    res.json(blockchain.getBlocks());
})

// POST api to add a transaction block to the chain
app.post('/blockchain', (req,res) => {
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
    console.log('Node is running on PORT: ' + PORT);
})


