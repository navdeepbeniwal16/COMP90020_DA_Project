const Block = require('./Block.js');

class Blockchain {
    static GENESIS_SEED_HASH = 0
    chain = [];
    unverifiedTransactions = []; // TODO: Unsure where and how this is going to be used
    
    constructor() {
        const block = new Block([], this.GENESIS_SEED_HASH)
        this.chain.push(block);
    }

    getBlockchainSize() { return this.chain.length; }    
    
    addBlock(transactionsBlock) {
        const prevBlockHash = this.chain[this.getBlockchainSize()-1].hash;
        const newBlock = new Block(transactionsBlock, prevBlockHash);
        this.chain.push(newBlock);
    }

    validateBlockchain() {
        if(this.getBlockchainSize() == 1) return true;

        for(let chainIndex=1; chainIndex < this.getBlockchainSize(); chainIndex++) {
            const currentBlock = this.chain[chainIndex];
            const previousBlock = this.chain[chainIndex - 1];

            if(currentBlock.generateHash() !== currentBlock.hash) { // block computed hash not same as stored hash
                console.log('Block computed hash not same as stored hash...');
                return false;
            }

            if(currentBlock.previousHash !== previousBlock.generateHash()) {
                console.log('Previous block stored hash is invalid');
                console.log('PrevBlock Stored Hash : ' + currentBlock.previousHash);
                console.log('PrevBlock Generated Hash : ' + previousBlock.generateHash());
                return false;
            }
        }

        return true;
    }

    printBlockchain() {
        console.log(`Chain : ${JSON.stringify(this.chain)}`);
        console.log(`Unverified Transactions : ${JSON.stringify(this.unverifiedTransactions)}`);
    }
}

module.exports = Blockchain;