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
    if (this.isProcessing || this.updateQueue.length === 0) return;

    this.isProcessing = true;
    while (this.updateQueue.length > 0) {
      const update = this.updateQueue.shift();
      try {
        await this.processUpdate(update);
      } catch (error) {
        console.error("Error processing update:", error);
      }
    }
    this.isProcessing = false;
  }

  // Process a single update
  async processUpdate(update) {
    const { type, nodeId, status, tradingLoss } = update;

    switch (type) {
      case EVENT_TYPES.NODE_UPDATE:
        this.updateNode(nodeId, status, tradingLoss);
        break;
      case EVENT_TYPES.BATCH_UPDATE:
        for (const nodeUpdate of status) {
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

  // Clear all queues and states
  clearAll() {
    this.updateQueue = [];
    this.isProcessing = false;
    this.nodeStates.clear();
    this.tradingLosses.clear();
    // Don't clear listeners as they might be needed for the next session
  }
}

// Create a singleton instance
const flowChartEventEmitter = new FlowChartEventEmitter();
export default flowChartEventEmitter;
