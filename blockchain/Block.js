const cryto = require('crypto');

class Block {
    constructor(transactions, previousHash, nonce=0) {
        this.timestamp = new Date().getTime().toLocaleString()
        this.transactions = transactions;
        this.previousHash = previousHash;
        this.nonce = nonce
        this.hash =  this.generateHash()
    }

    generateHash() {
        const blockContents = this.timestamp + JSON.stringify(this.transactions) + this.previousHash + this.nonce.toString();
        return cryto.createHash('sha256').update(blockContents).digest('hex')
    }

    printBlock() {
        console.log(`Block {
            timestamp: ${this.timestamp},
            transactions: ${JSON.stringify(this.transactions)},
            previousHash: ${this.previousHash},
            nonce: ${this.nonce},
            hash: ${this.hash}
        }`);
    }
}

module.exports = Block;