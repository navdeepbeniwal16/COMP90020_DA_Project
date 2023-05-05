const Block = require('./Block.js');

class Blockchain {
    static GENESIS_SEED_HASH = 0
    unverifiedTransactionsBlocks = [];
    unverifiedChainBlocks = [];
    chain = [];

    constructor() {
        console.log("hannan checkpoint 6 genesis seed hash value"); //TODO: TBR
        console.log(Blockchain.GENESIS_SEED_HASH);
        const block = new Block([], Blockchain.GENESIS_SEED_HASH);
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

    forgeBlock(transactionBlock) {
        const prevBlockHash = this.chain[this.getChainSize()-1].hash;
        const newBlock = new Block(transactionBlock.transactions, prevBlockHash, transactionBlock.timestamp);
        return newBlock;
    }

    validateBlock(transactionBlock, block) {
        // check if their own forged block is same as the one sent by the network node
        const forgedBlock = this.forgeBlock(transactionBlock);
        if(block.hash !== forgedBlock.generateHash()) {
            return false;
        }

        return true;
    }
    
    commitBlock(block) {
        this.chain.push(block)
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
            var hashchecking = currentBlock.generateHash();
            if(currentBlock.generateHash() !== currentBlock.hash) { // block computed hash not same as stored hash
                console.log(`generatedHash is ${hashchecking}`);
                console.log(`current block hash is ${currentBlock.hash}`);
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