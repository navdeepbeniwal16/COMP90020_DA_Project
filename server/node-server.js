const express = require('express');
const app = express();
const process = require('process');
const Block = require('../blockchain/Block.js');
const Blockchain = require('../blockchain/Blockchain.js');
const axios = require('axios');
const os = require('os');
const bodyParser = require('body-parser')

const networkManager = process.argv[3];
const PORT = process.argv[2]; // accessing the port provided by the user/script
workernodes = {};

if(!PORT) {
    console.log('Port number missing in the arguments...');
    process.exit(0);
}
if(!networkManager){
    console.log("Network Manager not provided, please provide the network manager's ip address along with port");
    process.exit(0);
}

app.use(bodyParser.json())

// register and deregister functions 
function registerNM () {
    axios.post(`http://${networkManager}/register`, {"hostname":os.hostname(), "port":PORT},{})
    .then(response => {
        console.log("client successfully registered");
        resworkernodes = response.data;
        for (nodes in resworkernodes){
            workernodes[nodes] = resworkernodes[nodes];
        }
    })
    .catch(error => {
        console.error(error);
    })
}

function deregisterNM(){
    axios.post(`http://${networkManager}/deregister`,{"hostname":os.hostname(), "port":PORT},{})
    .then(response => {
        console.log(response.data);
    })
    .catch(error => {
        console.error(error);
    })
}





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

app.post('/registernodes',(req,res) => {
    const body = req.body;
    const address = body.address;
    const hostname = body.hostname;
    if(!(address in workernodes)){
        workernodes[address]=hostname;
        var ownaddress = req.socket.localAddress;
        ownaddress = ownaddress.replace("::ffff:","");
        res.send(ownaddress+":"+PORT+" successfully added the new node "+address+ " in the list");
    }
})

app.post('/deregisternodes',(req,res) => {
    const body = req.body;
    const address = body.address;
    const hostname = body.hostname;
    if(address in workernodes){
        delete workernodes[address];
    }
})

app.get('/register',(req,res) => {
    registerNM();
    res.send("successfully registered");
})
app.get('/deregister',(req,res) => {
    deregisterNM();
    res.send("successfully deregistered");
})


// TODO: API to validate the blockchain
// TODO: API to update a block (to simulate an attack i.e changing a block in the blockchain)

app.listen(PORT, () => {
    console.log('Blockchain node is running on PORT: ' + PORT);
})

console.log("registering with the network manager");
registerNM();

