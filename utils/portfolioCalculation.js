import { ethers } from "ethers";
import assert from "assert";

/**
 * Calculates the rebalance reinvest USD amount for a specific chain
 * @param {string} chainFilter - The chain to filter by
 * @param {Object} rebalancableUsdBalanceDict - The rebalancable USD balance dictionary
 * @param {Object} pendingRewards - The pending rewards
 * @param {Object} portfolioHelper - The portfolio helper instance
 * @returns {number} The calculated USD amount
 */
export const getRebalanceReinvestUsdAmount = (
  chainFilter,
  rebalancableUsdBalanceDict,
  pendingRewards,
  portfolioHelper,
) => {
  const chain = chainFilter
    ?.replace(" one", "")
    .replace(" mainnet", "")
    .toLowerCase();

  if (chain === undefined) return 0;

  const filteredBalances = chain
    ? Object.values(rebalancableUsdBalanceDict).filter(
        (item) => item.chain === chain,
      )
    : Object.values(rebalancableUsdBalanceDict);

  const result =
    filteredBalances.reduce((sum, { usdBalance, zapOutPercentage }) => {
      return zapOutPercentage > 0 ? sum + usdBalance * zapOutPercentage : sum;
    }, 0) + portfolioHelper?.sumUsdDenominatedValues(pendingRewards);

  return result;
};

/**
 * Gets token metadata from the tokens list
 * @param {Object} chainId - The chain ID object
 * @param {string} tokenSymbol - The token symbol
 * @param {Object} tokens - The tokens list
 * @returns {string|null} The token metadata string or null
 */
export const getTokenMetadata = (chainId, tokenSymbol, tokens) => {
  if (!chainId) return null;

  const chainTokens =
    tokens.props.pageProps.tokenList[String(chainId?.id)] || [];
  if (!Array.isArray(chainTokens)) {
    return null;
  }

  const token = chainTokens.find(
    (token) => token.symbol?.toLowerCase() === tokenSymbol.toLowerCase(),
  );

  if (!token) {
    return null;
  }

  return `${token.symbol}-${token.value}-${token.decimals}`;
};

/**
 * Calculates USD denominated value for a token
 * @param {Object} params - Parameters for calculation
 * @param {string} params.symbol - Token symbol
 * @param {BigNumber} params.balance - Token balance
 * @param {number} params.decimals - Token decimals
 * @param {Object} params.tokenPricesMappingTable - Token prices mapping
 * @returns {number} USD denominated value
 */
export const calculateUsdDenominatedValue = ({
  symbol,
  balance,
  decimals,
  tokenPricesMappingTable,
}) => {
  const tokenPrice = tokenPricesMappingTable[symbol];
  if (tokenPrice === undefined) {
    return 0;
  }
  return (
    tokenPrice *
    Number(ethers.utils.formatUnits(balance, decimals))
  );
};

/**
 * Adds pending rewards to withdraw token balance
 * @param {Object} withdrawTokenAndBalance - Current token balances
 * @param {Object} pendingRewards - Pending rewards to add
 * @param {Object} tokenPricesMappingTable - Token prices mapping
 * @returns {Object} Updated token balances
 */
export const addPendingRewardsToBalance = (
  withdrawTokenAndBalance,
  pendingRewards,
  tokenPricesMappingTable,
) => {
  const updatedBalance = { ...withdrawTokenAndBalance };
  
  for (const [address, metadata] of Object.entries(pendingRewards)) {
    if (updatedBalance[address]) {
      updatedBalance[address].balance = updatedBalance[address].balance.add(metadata.balance);
      updatedBalance[address].usdDenominatedValue = calculateUsdDenominatedValue({
        symbol: metadata.symbol,
        balance: updatedBalance[address].balance,
        decimals: updatedBalance[address].decimals,
        tokenPricesMappingTable,
      });
    } else {
      updatedBalance[address] = metadata;
    }
  }
  
  return updatedBalance;
};

/**
 * Creates a token balance entry
 * @param {Object} params - Parameters for token balance
 * @param {string} params.address - Token address
 * @param {string} params.symbol - Token symbol
 * @param {BigNumber} params.balance - Token balance
 * @param {number} params.decimals - Token decimals
 * @param {Object} params.tokenPricesMappingTable - Token prices mapping
 * @returns {Object} Token balance entry
 */
export const createTokenBalanceEntry = ({
  address,
  symbol,
  balance,
  decimals,
  tokenPricesMappingTable,
}) => {
  const usdDenominatedValue = calculateUsdDenominatedValue({
    symbol,
    balance,
    decimals,
    tokenPricesMappingTable,
  });
  console.log("balance", balance);
  console.log("balance", balance);
  console.log("balance", balance);
  console.log("balance", balance);
  // Validate USD value for non-zero balances
  if (!balance.isZero()) {
    assert(
      !isNaN(usdDenominatedValue) && usdDenominatedValue > 0,
      `Invalid USD value for ${symbol}: ${usdDenominatedValue}`
    );
  }

  return {
    symbol,
    balance,
    usdDenominatedValue,
    decimals,
  };
};
