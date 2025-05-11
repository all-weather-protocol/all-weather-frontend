// Define event types outside the class
const EVENT_TYPES = {
  NODE_UPDATE: "NODE_UPDATE",
  TRADING_LOSS_UPDATE: "TRADING_LOSS_UPDATE",
  EDGE_UPDATE: "EDGE_UPDATE",
  BATCH_UPDATE: "BATCH_UPDATE",
};

class FlowChartEventEmitter {
  constructor() {
    this.listeners = new Map();
    this.nodeStates = new Map();
    this.tradingLosses = new Map();
    this.updateQueue = [];
    this.isProcessing = false;
    this.isClearing = false;
  }

  // Event types
  static get EVENT_TYPES() {
    return EVENT_TYPES;
  }

  // Subscribe to events
  subscribe(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType).add(callback);
    return () => this.unsubscribe(eventType, callback);
  }

  // Unsubscribe from events
  unsubscribe(eventType, callback) {
    if (this.listeners.has(eventType)) {
      this.listeners.get(eventType).delete(callback);
    }
  }

  // Emit an event
  emit(eventType, data) {
    if (this.listeners.has(eventType)) {
      this.listeners.get(eventType).forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${eventType}:`, error);
        }
      });
    }
  }

  // Update node state
  updateNode(nodeId, status, tradingLoss = null) {
    this.nodeStates.set(nodeId, {
      status,
      timestamp: Date.now(),
    });

    if (tradingLoss !== null) {
      this.tradingLosses.set(nodeId, tradingLoss);
    }

    this.emit(EVENT_TYPES.NODE_UPDATE, {
      nodeId,
      status,
      tradingLoss,
    });
  }

  // Get node state
  getNodeState(nodeId) {
    return {
      status: this.nodeStates.get(nodeId)?.status || "pending",
      tradingLoss: this.tradingLosses.get(nodeId) || null,
    };
  }

  // Queue an update
  queueUpdate(update) {
    this.updateQueue.push(update);
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  // Process the update queue
  async processQueue() {
    if (this.isProcessing || this.updateQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    try {
      while (this.updateQueue.length > 0) {
        const update = this.updateQueue.shift();
        await this.processUpdate(update);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  // Process a single update
  async processUpdate(update) {
    const { type, nodeId, status, tradingLoss } = update;
    // Check if node exists in states
    if (!this.nodeStates.has(nodeId)) {
      console.warn(`Node ${nodeId} not found in states, skipping update`);
      return;
    }

    switch (type) {
      case EVENT_TYPES.NODE_UPDATE:
        this.updateNode(nodeId, status, tradingLoss);
        break;
      case EVENT_TYPES.BATCH_UPDATE:
        for (const nodeUpdate of status) {
          if (!this.nodeStates.has(nodeUpdate.nodeId)) {
            console.warn(
              `Node ${nodeUpdate.nodeId} not found in states, skipping batch update`,
            );
            continue;
          }
          this.updateNode(
            nodeUpdate.nodeId,
            nodeUpdate.status,
            nodeUpdate.tradingLoss,
          );
        }
        break;
      default:
        console.warn(`Unknown update type: ${type}`);
    }
  }

  // Batch update multiple nodes
  batchUpdate(updates) {
    this.queueUpdate({
      type: EVENT_TYPES.BATCH_UPDATE,
      status: updates,
    });
  }

  // Clear all queues and states and initialize nodes
  async clearAll(nodeIds = []) {
    // First clear everything
    this.updateQueue = [];
    this.isProcessing = false;
    this.nodeStates.clear();
    this.tradingLosses.clear();

    // Initialize nodes if provided
    if (nodeIds.length > 0) {
      // Initialize all nodes as inactive
      nodeIds.forEach((nodeId) => {
        this.nodeStates.set(nodeId, {
          status: "inactive",
          timestamp: Date.now(),
        });
        this.tradingLosses.set(nodeId, null);
      });

      // Process any queued updates
      await this.processQueue();
    }

    // Add a small delay to ensure all operations are complete
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Check if event emitter is ready
  isReady() {
    return !this.isProcessing && this.updateQueue.length === 0;
  }
}

// Create a singleton instance
const flowChartEventEmitter = new FlowChartEventEmitter();
export default flowChartEventEmitter;
