class Logger {
    constructor(nodeId, nodeType) {
        this.nodeId = nodeId;
        this.nodeType = nodeType;
    }

    createLogMessage(eventType, eventDescription, isNetworkingEvent, data={}) {
        this.eventType = eventType;
        this.eventDescription = eventDescription;
        this.isNetworkingEvent = isNetworkingEvent;
        this.data = data;
        this.timestamp = new Date().toISOString();
        return this.getJSON();
    }

    getJSON() {
        return {
            "timestamp" : this.timestamp,
            "nodeId" : this.nodeId,
            "nodeType" : this.nodeType,
            "eventType" : this.eventType,
            "eventDescription" : this.eventDescription,
            "isNetworkingEvent" : this.isNetworkingEvent,
            "data" : this.data
        }
    }
}

const NodeType = {
    Blockchain: 'Blockchain',
    NetworkManager: 'NetworkManager',
};

const EventType = {
    BlockchainEventType: {
        PooledTransactions : 'PooledTransactions',
        ValidatedTransactions : 'ValidatedTransactions',
        InvalidatedTransactions : 'InvalidatedTransactions',
        ForgedTransactionsBlock : 'ForgedTransactionsBlock',
        PooledTransactionsBlock : 'PooledTransactionsBlock',
        ValidatedBlock : 'ValidatedBlock',
        InvalidatedBlock : 'InvalidatedBlock',
        ValidatedBlockchain : 'ValidatedBlockchain',
        DiscardedBlock : 'DiscardedBlock',
        CommittedBlock : 'CommittedBlock'

    },
    NetworkEventType: {
        RegisteredBlockchainNode: 'RegisteredBlockchainNode',
        DeregisteredBlockchainNode: 'DeregisteredBlockchainNode'
    },
    NodeEventType : {
        PoolingTransactions : 'PoolingTransactions',
        ValidatingTransactions : 'ValidatingTransactions',
        InvalidatingTransactions : 'InvalidatingTransactions',
        ForgingTransactionsBlock : 'ForgingTransactionsBlock',
        PoolingTransactionsBlock : 'PoolingTransactionsBlock',
        ValidatingBlock : 'ValidatingBlock',
        InvalidatingBlock : 'InvalidatingBlock',
        ValidatingBlockchain : 'ValidatingBlockchain',
        DiscardingBlock : 'DiscardingBlock',
        CommittingBlock : 'CommittingBlock'
    },
    Error : 'Error'
};

// const EventCategory = {
//     Networking : 'Networking',
//     GeneralProcessing : 'GeneralProcessing',
//     BlockchainProcessing : 'BlockchainProcessing'
// }

module.exports = { Logger , NodeType, EventType };