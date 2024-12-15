import { ethers } from "ethers";
import { toFixedString } from "../utils/general";

export const generateIntentTxns = async (
  actionName,
  chainMetadata,
  portfolioHelper,
  accountAddress,
  tokenSymbol,
  tokenAddress,
  investmentAmount,
  tokenDecimals,
  zapOutPercentage,
  setTradingLoss,
  setStepName,
  slippage,
  rebalancableUsdBalanceDict,
  recipient,
  protocolAssetDustInWallet,
  onlyThisChain,
) => {
  let txns;
  if (actionName === "zapIn") {
    txns = await portfolioHelper.portfolioAction("zapIn", {
      account: accountAddress,
      chainMetadata: chainMetadata,
      tokenInSymbol: tokenSymbol,
      tokenInAddress: tokenAddress,
      zapInAmount: ethers.utils.parseUnits(
        toFixedString(investmentAmount, tokenDecimals),
        tokenDecimals,
      ),
      setTradingLoss,
      setStepName,
      slippage,
      onlyThisChain,
    });
  } else if (actionName === "zapOut") {
    txns = await portfolioHelper.portfolioAction("zapOut", {
      account: accountAddress,
      chainMetadata,
      tokenOutSymbol: tokenSymbol,
      tokenOutAddress: tokenAddress,
      zapOutPercentage: Number(zapOutPercentage),
      setTradingLoss,
      setStepName,
      slippage,
      onlyThisChain,
    });
  } else if (actionName === "claimAndSwap") {
    txns = await portfolioHelper.portfolioAction(actionName, {
      account: accountAddress,
      chainMetadata,
      tokenOutAddress: tokenAddress,
      setTradingLoss,
      setStepName,
      slippage,
      onlyThisChain,
    });
  } else if (actionName === "rebalance") {
    txns = await portfolioHelper.portfolioAction(actionName, {
      account: accountAddress,
      chainMetadata,
      setTradingLoss,
      setStepName,
      slippage,
      rebalancableUsdBalanceDict,
      onlyThisChain,
    });
  } else if (actionName === "transfer") {
    txns = await portfolioHelper.portfolioAction(actionName, {
      account: accountAddress,
      chainMetadata,
      zapOutPercentage: Number(zapOutPercentage),
      setTradingLoss,
      setStepName,
      slippage,
      recipient,
      onlyThisChain,
    });
  } else if (actionName === "stake") {
    txns = await portfolioHelper.portfolioAction(actionName, {
      account: accountAddress,
      chainMetadata,
      setTradingLoss,
      setStepName,
      protocolAssetDustInWallet,
      onlyThisChain,
    });
  }

  return txns;
};
