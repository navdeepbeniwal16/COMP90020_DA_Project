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
}

module.exports = Block;