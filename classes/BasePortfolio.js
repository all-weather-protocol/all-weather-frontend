import { tokensAndCoinmarketcapIdsFromDropdownOptions } from "../utils/contractInteractions";
import assert from "assert";
import { oneInchAddress } from "../utils/oneInch";
import axios from "axios";
import { ethers } from "ethers";
import { getTokenDecimal, approve } from "../utils/general";
export class BasePortfolio {
  constructor(strategy, weightMapping) {
    this.strategy = strategy;
    this.portfolioAPR = {};
    this.existingInvestmentPositions = {};
    this.assetAddressSetByChain = this._getAssetAddressSetByChain();
    this.uniqueTokenIdsForCurrentPrice =
      this._getUniqueTokenIdsForCurrentPrice();
    this.weightMapping = weightMapping;
  }
  async initialize() {
    this.existingInvestmentPositions =
      await this._getExistingInvestmentPositionsByChain(
        account.address,
        updateProgress,
      );
  }
  description() {
    throw new Error("Method 'description()' must be implemented.");
  }
  async usdBalanceOf(address) {
    let usdBalance = 0;
    for (const protocolsInThisCategory of Object.values(this.strategy)) {
      for (const protocolsInThisChain of Object.values(
        protocolsInThisCategory,
      )) {
        for (const protocol of protocolsInThisChain) {
          if (protocol.weight === 0) continue;
          const balance = await protocol.interface.usdBalanceOf(address);
          usdBalance += balance;
        }
      }
    }
    return usdBalance;
  }
  async pendingRewards(recipient, updateProgress) {
    const tokenPricesMappingTable =
      await this._getTokenPricesMappingTable(updateProgress);

    let rewardsMappingTable = {};
    for (const protocolsInThisCategory of Object.values(this.strategy)) {
      for (const protocolsInThisChain of Object.values(
        protocolsInThisCategory,
      )) {
        for (const protocol of protocolsInThisChain) {
          if (protocol.weight === 0) continue;
          const rewards = await protocol.interface.pendingRewards(
            recipient,
            tokenPricesMappingTable,
            updateProgress,
          );
          for (const [tokenAddress, rewardMetadata] of Object.entries(
            rewards,
          )) {
            if (!rewardsMappingTable[tokenAddress]) {
              rewardsMappingTable[tokenAddress] = {};
            }
            rewardsMappingTable[tokenAddress]["balance"] = (
              rewardsMappingTable[tokenAddress]["balance"] ||
              ethers.BigNumber.from(0)
            ).add(rewardMetadata.balance);
            rewardsMappingTable[tokenAddress]["usdDenominatedValue"] =
              (rewardsMappingTable[tokenAddress]["usdDenominatedValue"] || 0) +
              rewardMetadata.usdDenominatedValue;
            rewardsMappingTable[tokenAddress]["decimals"] =
              rewardMetadata.decimals;
            rewardsMappingTable[tokenAddress]["symbol"] = rewardMetadata.symbol;
          }
        }
      }
    }
    return rewardsMappingTable;
  }
  async getPortfolioAPR() {
    let aprMappingTable = {};
    const allProtocols = Object.values(this.strategy).flatMap((protocols) =>
      Object.entries(protocols).flatMap(([chain, protocolArray]) =>
        protocolArray.map((protocol) => ({ chain, protocol })),
      ),
    );
    await Promise.all(
      allProtocols.map(async ({ chain, protocol }) => {
        const poolUniqueKey = protocol.interface.uniqueId();
        const url = `${process.env.NEXT_PUBLIC_API_URL}/pool/${poolUniqueKey}/apr`;
        try {
          const response = await fetch(url);
          const data = await response.json();
          aprMappingTable[poolUniqueKey] = {
            apr: data.value,
            weight: protocol.weight,
          };
        } catch (error) {
          console.error(`Error fetching data for ${url}:`, error);
          return null;
        }
      }),
    );
    aprMappingTable["portfolioAPR"] = Object.values(aprMappingTable).reduce(
      (sum, pool) => sum + pool.apr * pool.weight,
      0,
    );
    return aprMappingTable;
  }
  async getExistingInvestmentPositions() {
    throw new Error(
      "Method 'getExistingInvestmentPositions()' must be implemented.",
    );
  }

  async portfolioAction(actionName, actionParams) {
    let completedSteps = 0;
    const totalSteps =
      this._countProtocolStepsWithThisAction(actionName) +
      Object.keys(this.uniqueTokenIdsForCurrentPrice).length +
      Object.keys(this.assetAddressSetByChain).length;
    const updateProgress = (actionName) => {
      completedSteps++;
      actionParams.progressCallback((completedSteps / totalSteps) * 100);
      actionParams.progressStepNameCallback(actionName);
    };
    const tokenPricesMappingTable =
      await this._getTokenPricesMappingTable(updateProgress);
    actionParams.tokenPricesMappingTable = tokenPricesMappingTable;
    actionParams.updateProgress = updateProgress;
    return this._generateTxnsByAction(actionName, actionParams);
  }
  async getTokenPricesMappingTable() {
    throw new Error(
      "Method 'getTokenPricesMappingTable()' must be implemented.",
    );
  }
  async _generateTxnsByAction(actionName, actionParams) {
    let totalTxns = [];
    if (actionName === "zapIn") {
      const inputTokenDecimal = await getTokenDecimal(
        actionParams.tokenInAddress,
      );
      const approveTxn = approve(
        actionParams.tokenInAddress,
        oneInchAddress,
        actionParams.zapInAmount,
        inputTokenDecimal,
        actionParams.updateProgress,
      );
      totalTxns.push(approveTxn);
    }
    for (const protocolsInThisCategory of Object.values(this.strategy)) {
      for (const [chain, protocols] of Object.entries(
        protocolsInThisCategory,
      )) {
        for (const protocol of protocols) {
          if (protocol.weight === 0) {
            continue;
          }
          // make it concurrent!
          let txnsForThisProtocol;
          if (actionName === "zapIn") {
            txnsForThisProtocol = await protocol.interface.zapIn(
              actionParams.account.address,
              Number(actionParams.zapInAmount * protocol.weight),
              actionParams.tokenInSymbol,
              actionParams.tokenInAddress,
              actionParams.slippage,
              actionParams.tokenPricesMappingTable,
              actionParams.updateProgress,
              this.existingInvestmentPositions[chain],
            );
          } else if (actionName === "zapOut") {
            txnsForThisProtocol = await protocol.interface.zapOut(
              actionParams.account.address,
              Number(actionParams.zapOutPercentage * protocol.weight),
              actionParams.tokenOutAddress,
              actionParams.slippage,
              actionParams.tokenPricesMappingTable,
              actionParams.updateProgress,
              this.existingInvestmentPositions[chain],
            );
          } else if (actionName === "rebalance") {
            throw new Error("Method 'rebalance()' must be implemented.");
          } else if (actionName === "claimAndSwap") {
            txnsForThisProtocol = await protocol.interface.claimAndSwap(
              actionParams.account.address,
              actionParams.tokenOutAddress,
              actionParams.slippage,
              actionParams.tokenPricesMappingTable,
              actionParams.updateProgress,
              this.existingInvestmentPositions[chain],
            );
          }
          totalTxns = totalTxns.concat(txnsForThisProtocol);
        }
      }
    }
    return totalTxns;
  }

  async _getExistingInvestmentPositionsByChain(address, updateProgress) {
    let existingInvestmentPositionsbyChain = {};
    for (const [chain, lpTokens] of Object.entries(
      this.assetAddressSetByChain,
    )) {
      const response = await fetch(
        `${
          process.env.NEXT_PUBLIC_API_URL
        }/${address}/nft/tvl_highest?token_addresses=${Array.from(
          lpTokens,
        ).join("+")}&chain=${chain}`,
      );
      const data = await response.json();
      existingInvestmentPositionsbyChain[chain] = data;
      updateProgress(`Fetching ${chain}\'s investment positions: ${lpTokens}`);
    }
    return existingInvestmentPositionsbyChain;
  }

  _getUniqueTokenIdsForCurrentPrice() {
    let coinMarketCapIdSet = {};
    for (const protocolsInThisCategory of Object.values(this.strategy)) {
      for (const protocols of Object.values(protocolsInThisCategory)) {
        for (const protocol of protocols) {
          const apiSymbolToIdMapping = Object.values(
            protocol.interface.tokens(),
          )
            .flatMap((tokenArray) =>
              Array.isArray(tokenArray) ? tokenArray : [],
            )
            .reduce((idMapping, token) => {
              if (token.coinmarketcapApiId !== undefined) {
                idMapping[token.symbol] = token.coinmarketcapApiId;
              }
              return idMapping;
            }, {});
          coinMarketCapIdSet = {
            ...coinMarketCapIdSet,
            ...apiSymbolToIdMapping,
          };
        }
      }
    }

    coinMarketCapIdSet = {
      ...coinMarketCapIdSet,
      ...tokensAndCoinmarketcapIdsFromDropdownOptions,
    };
    return coinMarketCapIdSet;
  }
  _getAssetAddressSetByChain() {
    let assetAddressSetByChain = {};
    for (const protocolsInThisCategory of Object.values(this.strategy)) {
      for (const [chain, protocols] of Object.entries(
        protocolsInThisCategory,
      )) {
        if (!assetAddressSetByChain[chain]) {
          assetAddressSetByChain[chain] = new Set();
        }
        for (const protocol of protocols) {
          assetAddressSetByChain[chain].add(protocol.interface.assetAddress);
        }
      }
    }
    return assetAddressSetByChain;
  }
  async _getTokenPricesMappingTable(updateProgress) {
    let tokenPricesMappingTable = {};
    for (const [token, coinMarketCapId] of Object.entries(
      this.uniqueTokenIdsForCurrentPrice,
    )) {
      axios
        .get(
          `${process.env.NEXT_PUBLIC_API_URL}/token/${coinMarketCapId}/price`,
        )
        .then((result) => {
          tokenPricesMappingTable[token] = result.data.price;
        });
      updateProgress(`Fetching price for ${token}`);
    }
    return tokenPricesMappingTable;
  }
  validateStrategyWeights() {
    let totalWeight = 0;
    for (const protocolsInThisCategory of Object.values(this.strategy)) {
      for (const protocolsInThisChain of Object.values(
        protocolsInThisCategory,
      )) {
        for (const protocol of protocolsInThisChain) {
          totalWeight += protocol.weight;
        }
      }
    }
    const epsilon = 0.00001; // To account for floating point imprecision
    assert(
      Math.abs(totalWeight - 1) < epsilon,
      `Total weight across all strategies should be 1, but is ${totalWeight}`,
    );
  }
  _countProtocolStepsWithThisAction(actionName) {
    let counts = 0;
    for (const protocolsInThisCategory of Object.values(this.strategy)) {
      for (const protocolsInThisChain of Object.values(
        protocolsInThisCategory,
      )) {
        for (const protocol of protocolsInThisChain) {
          if (actionName === "zapIn") {
            counts += protocol.interface.zapInSteps();
          } else if (actionName === "zapOut") {
            counts += protocol.interface.zapOutSteps();
          } else if (actionName === "claimAndSwap") {
            counts += protocol.interface.claimAndSwapSteps();
          } else {
            throw new Error(`Method '${actionName}()' must be implemented.`);
          }
        }
      }
    }
    return counts;
  }
}
