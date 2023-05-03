const express = require("express");
const app = express();
const process = require('process');
const Block = require('../blockchain/Block.js');
const Blockchain = require('../blockchain/Blockchain.js');
const bodyParser = require('body-parser');
const http = require("http");
const axios = require("axios");
const requestIp = require('request-ip')

app.use(bodyParser.json())

transactionqueue = [];
transactionblock = [];
workernodes ={};
const PORT = process.argv[2]
if(!PORT) {
    console.log('Port number missing in the arguments...');
    process.exit(0);
}

function getTransactionBlockLength() {
    console.log(`${transactionqueue.length}`);
    return transactionqueue.length;
}

app.post('/register',(req,res) => {
    console.log("register function");
    const body = req.body;
    const address = requestIp.getClientIp(req);
    const hostname = body.hostname;

    if(!(address in workernodes)){
        workernodes[address]=hostname;
    }
})

app.post('/deregister', (req,res) => {
    console.log("deregister function");
    const body = req.body;
    const address = requestIp.getClientIp(req);
    const hostname = body.hostname;
    if(address in workernodes){
        delete workernodes[address];
    }
    else {
        console.log("could not find the address in the registery to deregister");
    }
})


app.post('/transactions', (req,res) => {
    const body = req.body;
    const transactions = body.transaction;
    const timestamp = body.timestamp;

    // TODO: Add transaction validations

    // adding transactions to the blockchain
    try {
        transactionqueue.push({transactions, timestamp});
        if (getTransactionBlockLength() >= 3){
            //send to the node-server
            
            transactionblock=transactionqueue.slice(0,3);
            transactionqueue.splice(0,3);
            res.send(transactionblock);
            
            if (workernodes.length > 0){
                for(keys in workernodes){
                    axios.post(`${keys}/blockchain`, transactionblock,{})
                    .then(response => {
                        console.log(response.data);
                    })
                    .catch(error => {
                        console.error(error);
                    });
                }    
            }
            else {
                console.log("no workers nodes registered with the network manager");
            }
            
            
        }
        return res.status(201).send();
    } catch (error) {
        return res.status(500).send();
    }
})


app.listen(PORT, () => {
    console.log('Network manager is running on PORT: ' + PORT);
})
