import { describe, it, expect, beforeEach } from "vitest";
import { BaseVault } from "../../classes/Vaults/BaseVault";

// Mock protocol interface class
class MockProtocol {
  uniqueId() {
    return this.id;
  }
  constructor(id) {
    this.id = id;
  }
  rewards() {
    return [];
  }
}

describe("BaseVault", () => {
  let mockStrategies;
  let weightMapping;

  beforeEach(() => {
    // Setup mock strategies for each test
    mockStrategies = {
      staking: {
        ethereum: [
          { interface: new MockProtocol("eth-staking-1"), weight: 0.6 },
          { interface: new MockProtocol("eth-staking-2"), weight: 0.4 },
        ],
        polygon: [
          { interface: new MockProtocol("poly-staking-1"), weight: 1.0 },
        ],
      },
      lending: {
        ethereum: [
          { interface: new MockProtocol("eth-lending-1"), weight: 1.0 },
        ],
      },
    };

    weightMapping = {
      staking: 0.7,
      lending: 0.3,
    };
  });

  it("should create a vault with valid weights", () => {
    const vault = new BaseVault(mockStrategies, weightMapping, "Test Vault");
    expect(vault.portfolioName).toBe("Test Vault");
    expect(vault.weightMapping).toEqual(weightMapping);
  });

  it("should throw error if weight mapping doesn't sum to 1", () => {
    const invalidWeightMapping = {
      staking: 0.7,
      lending: 0.4, // Total is 1.1
    };

    expect(() => {
      new BaseVault(mockStrategies, invalidWeightMapping, "Test Vault");
    }).toThrow("Weight mapping must sum to 1");
  });

  it("should throw error on duplicate protocols", () => {
    const duplicateStrategies = {
      staking: {
        ethereum: [
          { interface: new MockProtocol("eth-staking-1"), weight: 0.5 },
          { interface: new MockProtocol("eth-staking-1"), weight: 0.5 }, // Duplicate ID
        ],
      },
    };

    expect(() => {
      new BaseVault(duplicateStrategies, { staking: 1 }, "Test Vault");
    }).toThrow("Duplicate protocol found");
  });

  it("should correctly normalize and scale weights", () => {
    const vault = new BaseVault(mockStrategies, weightMapping, "Test Vault");

    // Check if staking protocols are properly scaled (0.7 total weight)
    const ethStakingProtocols = vault.strategy.staking.ethereum;
    expect(ethStakingProtocols[0].weight).toBeCloseTo(0.21, 5); // 0.6 * 0.35 = 0.21
    expect(ethStakingProtocols[1].weight).toBeCloseTo(0.14, 5); // 0.4 * 0.35 = 0.14

    // Check if lending protocols are properly scaled (0.3 total weight)
    const ethLendingProtocols = vault.strategy.lending.ethereum;
    expect(ethLendingProtocols[0].weight).toBeCloseTo(0.3, 5);
  });
});

describe("BaseVault - Derivative Calculation", () => {
  const createMockProtocolInterface = (id) => ({
    uniqueId: () => `mock-protocol-${id}`,
    getZapInFlowChartData: () => ({
      nodes: [{ id: "mock-node", name: "Mock" }],
      edges: [],
    }),
    rewards: () => [],
  });

  const mockStrategy = {
    category1: {
      arbitrum: Array.from({ length: 2 }, (_, i) => ({
        interface: createMockProtocolInterface(i + 1),
        weight: i === 0 ? 0.3 : 0.2,
      })),
      optimism: Array.from({ length: 2 }, (_, i) => ({
        interface: createMockProtocolInterface(i + 3),
        weight: i === 0 ? 0.3 : 0.2,
      })),
    },
    category2: {
      arbitrum: Array.from({ length: 2 }, (_, i) => ({
        interface: createMockProtocolInterface(i + 5),
        weight: i === 0 ? 0.1 : 0.4,
      })),
      optimism: Array.from({ length: 2 }, (_, i) => ({
        interface: createMockProtocolInterface(i + 7),
        weight: i === 0 ? 0.2 : 0.5,
      })),
    },
  };

  it("should return 1 when onlyThisChain is false", () => {
    const portfolio = new BaseVault(mockStrategy, {
      category1: 0.5,
      category2: 0.5,
    });

    const derivative = portfolio._calculateDerivative("arbitrum", false);
    expect(derivative).toBe(1);
  });

  it("should calculate correct derivative for arbitrum chain", () => {
    const portfolio = new BaseVault(mockStrategy, {
      category1: 0.5,
      category2: 0.5,
    });

    // Print out all protocols and their weights
    Object.entries(mockStrategy).forEach(([category, chains]) => {
      Object.entries(chains).forEach(([chain, protocols]) => {
        console.log(`\n${category} - ${chain}:`);
        protocols.forEach((protocol) => {
          console.log(
            `Protocol ID: ${protocol.interface.uniqueId()}, Weight: ${
              protocol.weight
            }`,
          );
        });
      });
    });

    const derivative = portfolio._calculateDerivative("arbitrum", true);
    expect(derivative).toBe(2.1818181818181817);
  });

  it("should calculate correct derivative for optimism chain", () => {
    const portfolio = new BaseVault(mockStrategy, {
      category1: 0.5,
      category2: 0.5,
    });

    // Total weight on optimism = 0.3 + 0.2 + 0.2 + 0.5 = 1.2
    const derivative = portfolio._calculateDerivative("optimism", true);
    expect(derivative).toBe(1.8461538461538458);
  });

  it("should return 0 for chain with no weight", () => {
    const portfolio = new BaseVault(mockStrategy, {
      category1: 0.5,
      category2: 0.5,
    });

    const derivative = portfolio._calculateDerivative("polygon", true);
    expect(derivative).toBe(0);
  });

  it("should throw error when all weights in a chain are zero", () => {
    const zeroWeightStrategy = {
      category1: {
        arbitrum: [
          { interface: createMockProtocolInterface(1), weight: 0 },
          { interface: createMockProtocolInterface(2), weight: 0 },
        ],
      },
    };

    expect(() => {
      new BaseVault(zeroWeightStrategy, { category1: 1 });
    }).toThrow("Category category1 weights sum to NaN, expected 1");
  });
});

describe("BaseVault - Chain Weight Calculations", () => {
  const createMockProtocolInterface = (id) => ({
    uniqueId: () => `mock-protocol-${id}`,
    getZapInFlowChartData: () => ({
      nodes: [{ id: "mock-node", name: "Mock" }],
      edges: [],
    }),
    rewards: () => [],
  });

  const mockStrategy = {
    category1: {
      arbitrum: [
        { interface: createMockProtocolInterface(1), weight: 0.3 },
        { interface: createMockProtocolInterface(2), weight: 0.2 },
      ],
      optimism: [
        { interface: createMockProtocolInterface(3), weight: 0.1 },
        { interface: createMockProtocolInterface(4), weight: 0.2 },
      ],
    },
    category2: {
      arbitrum: [{ interface: createMockProtocolInterface(5), weight: 0.4 }],
      polygon: [{ interface: createMockProtocolInterface(6), weight: 0.3 }],
    },
  };

  it("should calculate correct chain weights excluding current chain", () => {
    const portfolio = new BaseVault(mockStrategy, {
      category1: 0.5,
      category2: 0.5,
    });

    // Test for arbitrum as current chain
    const chainWeightsFromArbitrum =
      portfolio._calculateChainWeights("arbitrum");
    expect(chainWeightsFromArbitrum).toEqual({
      optimism: 0.1875, // 1/0.8*0.3*0.5
      polygon: 0.2142857142857143, // 1/0.7*0.3*0.5
    });

    // Test for optimism as current chain
    const chainWeightsFromOptimism =
      portfolio._calculateChainWeights("optimism");
    expect(chainWeightsFromOptimism).toEqual({
      arbitrum: 0.5982142857142858,
      polygon: 0.2142857142857143,
    });
  });

  it("should handle chain with no protocols", () => {
    const portfolio = new BaseVault(mockStrategy, {
      category1: 0.5,
      category2: 0.5,
    });

    const chainWeights = portfolio._calculateChainWeights("ethereum");
    expect(chainWeights).toEqual({
      arbitrum: 0.5982142857142858,
      optimism: 0.1875,
      polygon: 0.2142857142857143,
    });
  });

  it("should handle empty strategy", () => {
    const emptyStrategy = {};
    expect(() => {
      new BaseVault(emptyStrategy, {});
    }).toThrow("Weight mapping must sum to 1, got 0");
  });
});
