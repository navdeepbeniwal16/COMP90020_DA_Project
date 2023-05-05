const { v4: uuidv4 } = require('uuid');
const cryto = require('crypto');

class Block {
    constructor(transactions, previousHash, timestamp=null, nonce=0) {
        this.id = uuidv4();
        this.timestamp = timestamp;
        this.transactions = transactions;
        this.previousHash = previousHash;
        this.nonce = nonce
        this.hash =  this.generateHash()
    }

    generateHash() {
        let blockContents = JSON.stringify(this.transactions) + this.previousHash + this.nonce.toString();
        if(this.timestamp) blockContents += this.timestamp; // not adding the timestamp for the genesis block
        return cryto.createHash('sha256').update(blockContents).digest('hex')
    }

    printBlock() {
        console.log(`Block {
            id: ${this.id},
            timestamp: ${this.timestamp},
            transactions: ${JSON.stringify(this.transactions)},
            previousHash: ${this.previousHash},
            nonce: ${this.nonce},
            hash: ${this.hash}
        }`);
    }

    toJSON() {
        return {
            "id": this.id,
            "timestamp" : this.timestamp,
            "transactions" : JSON.stringify(this.transactions),
            "previousHash" : this.previousHash,
            "nonce" : this.nonce,
            "hash" : this.hash
        }
    }

    static createBlockFromJSON(blockJSON) {
        console.log("blockJSon received is");
        console.log(blockJSON);
        /*
        if (blockJSON.timestamp){
            console.log("timestamp is there");
        }
        if(blockJSON.transaction){
            console.log("transaction is true");
        }
        if(blockJSON.hash) {
            console.log("hash is there");
        }
        if(blockJSON.previousHash){
            console.log("previoshash is there");
        }
        if(!(blockJSON.transactions && blockJSON.timestamp && blockJSON.hash && blockJSON.previousHash)) {
            throw new Error('Required attributes missing');
        }
        */
        const transactions = JSON.parse(blockJSON.transactions); 
        const newBlock = new Block(transactions, blockJSON.previousHash, blockJSON.timestamp);

        newBlock.hash = blockJSON.hash;
        return newBlock;
    }
}

module.exports = Block;