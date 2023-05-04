const Block = require('./Block.js');

class Blockchain {
    static GENESIS_SEED_HASH = 0
    unverifiedTransactionsBlocks = [];
    unverifiedChainBlocks = [];
    chain = [];

    constructor() {
        const block = new Block([], this.GENESIS_SEED_HASH);
        this.chain.push(block);
    }

    getChainSize() { return this.chain.length; }  
    getUnverifiedTransactionsBlocksSize() { return this.unverifiedTransactionsBlocks.length; }
    getUnverifiedChainBlocksSize() { return this.unverifiedChainBlocks.length; }
    
    getBlocks() {
        return this.chain;
    }

    // APIs
    // Pool unverified transaction blocks
    // Forge Block
    // Validate Block
    // Commit Block

    poolUnverifiedTransactionsBlocks(transactionBlock) {
        this.unverifiedTransactionsBlocks.push(transactionBlock);
    }

    forgeBlock() {
        if(this.getUnverifiedTransactionsBlocksSize() == 0) {
            throw new Error('No transaction block available to be forged');
        }

        const transactionsBlock = this.unverifiedTransactionsBlocks[0];
        console.log('Transaction block (from unverified transactions) : '); // TODO: TBR
        console.log(transactionsBlock); // TODO: TBR
        const prevBlockHash = this.chain[this.getChainSize()-1].hash;
        const newBlock = new Block(transactionsBlock.transactions, prevBlockHash, transactionsBlock.timestamp);
        this.unverifiedChainBlocks.push(newBlock);
        this.unverifiedTransactionsBlocks = [];

        return newBlock;
    }

    validateBlock(block) {
        // TODO
        
    }
    
    commitBlock(transactionsBlock, timestamp) {
        // TODO
    }

    validateTransactions(transactions) {
        for(let tIndex=0; tIndex < transactions.length; transactions++) {
            const transaction = transactions[tIndex];
            if(!(transaction.transaction_id && transaction.timestamp && transaction.asset_id && transaction.sender && transaction.receiver && transaction.location && transaction.condition && transaction.quantity && transaction.price && transaction.type)) {
                throw new Error('Transaction missing required attributes');
            }
        }

        return true;
    }

    validateBlockchain() {
        if(this.getChainSize() == 1) return true;

        for(let chainIndex=1; chainIndex < this.getChainSize(); chainIndex++) {
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
        console.log(`Unverified Blocks : ${JSON.stringify(this.unverifiedChainBlocks)}`);
        console.log(`Unverified Transactions : ${JSON.stringify(this.unverifiedTransactionsBlocks)}`);
    }
}

module.exports = Blockchain;