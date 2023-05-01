const Block = require('../blockchain/Block.js');
const Blockchain = require('../blockchain/Blockchain.js');

mempool = [  
    { "sender": "Alice", "receiver": "Bob", "amount": 10 },
    { "sender": "Charlie", "receiver": "Alice", "amount": 5 },  
    { "sender": "Bob", "receiver": "Eve", "amount": 2 },
    { "sender": "Dave", "receiver": "Charlie", "amount": 8 },
    { "sender": "Eve", "receiver": "Alice", "amount": 3 }
]

transactionsBlock = []
transactionsBlock.push(mempool[0])
transactionsBlock.push(mempool[1])
transactionsBlock.push(mempool[2])

// const block = new Block(transaction, 0);
// block.printBlock()
const blockchain = new Blockchain();

console.log(`At size (${blockchain.getBlockchainSize()})`);
blockchain.printBlockchain();

blockchain.addBlock(transactionsBlock)

// console.log(`At size (${blockchain.getBlockchainSize()})`);
// blockchain.printBlockchain();

transactionsBlock = []
transactionsBlock.push(mempool[3])
transactionsBlock.push(mempool[4])
// blockchain.chain[1].transactions = transactionsBlock; // changing transactions within a blockchain

console.log('Is blockchain valid? ' + blockchain.validateBlockchain());
