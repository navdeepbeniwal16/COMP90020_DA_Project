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
    var address = req.socket.remoteAddress;
    address = address.replace("::ffff:","");
    console.log("received ip address is " + address);
    const hostname = body.hostname;
    console.log("received hostname is " + hostname);
    const remotePort = body.port;
    console.log("received client port is "+ remotePort);
    console.log("workernodes are ");
    console.log(workernodes);
    address = address + ":"+remotePort;
    console.log("address is " + address);
    if(!(address in workernodes)){
        workernodes[address]=hostname;
        console.log("workernodes after registering the node");
        console.log(workernodes);
        res.send("client successfully registered");
    }
    else {
        res.send("Client already registered");
    }
    
})

app.post('/deregister', (req,res) => {
    console.log("deregister function");
    const body = req.body;
    var address = req.socket.remoteAddress;
    address = address.replace("::ffff:","");
    console.log("received ip address is " + address);
    const hostname = body.hostname;
    console.log("received hostname is " + hostname);
    const remotePort = body.port;
    console.log("received client port is "+ remotePort);
    address = address + remotePort;
    if(address in workernodes){
        console.log("before deleting the address, the worker nodes are");
        console.log(workernodes);
        delete workernodes[address];
        console.log("after deleting the address, the worker nodes are");
        console.log(workernodes);
        res.send("client successfully deregistered");
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
                for(address in workernodes){
                    axios.post(`${address}/blockchain`, transactionblock,{})
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
