import { ethers } from "ethers";
import { toFixedString } from "../utils/general";

export const generateIntentTxns = async ({
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
  setTotalTradingLoss,
  setPlatformFee,
  slippage,
  rebalancableUsdBalanceDict,
  recipient,
  protocolAssetDustInWallet,
  protocolAssetDustInWalletLoading,
  onlyThisChain,
  usdBalance,
}) => {
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
      setTotalTradingLoss,
      setPlatformFee,
      slippage,
      onlyThisChain,
      tokenDecimals,
      protocolAssetDustInWallet,
      protocolAssetDustInWalletLoading,
    });
  } else if (actionName === "zapOut") {
    txns = await portfolioHelper.portfolioAction("zapOut", {
      account: accountAddress,
      chainMetadata,
      tokenOutSymbol: tokenSymbol,
      tokenOutAddress: tokenAddress,
      tokenOutDecimals: tokenDecimals,
      zapOutPercentage: Number(zapOutPercentage),
      setTradingLoss,
      setTotalTradingLoss,
      setPlatformFee,
      slippage,
      onlyThisChain,
      protocolAssetDustInWallet,
      protocolAssetDustInWalletLoading,
    });
  } else if (actionName === "claimAndSwap") {
    txns = await portfolioHelper.portfolioAction(actionName, {
      account: accountAddress,
      chainMetadata,
      outputToken: tokenAddress,
      outputTokenSymbol: tokenSymbol,
      outputTokenDecimals: tokenDecimals,
      setTradingLoss,
      setTotalTradingLoss,
      setPlatformFee,
      slippage,
      onlyThisChain,
      protocolAssetDustInWallet,
      protocolAssetDustInWalletLoading,
    });
  } else if (
    actionName === "crossChainRebalance" ||
    actionName === "localRebalance"
  ) {
    txns = await portfolioHelper.portfolioAction(actionName, {
      account: accountAddress,
      chainMetadata,
      setTradingLoss,
      setTotalTradingLoss,
      setPlatformFee,
      slippage,
      rebalancableUsdBalanceDict,
      onlyThisChain,
      usdBalance,
      tokenInSymbol: tokenSymbol,
      tokenInAddress: tokenAddress,
      zapInAmount: ethers.utils.parseUnits(
        toFixedString(investmentAmount, tokenDecimals),
        tokenDecimals,
      ),
      protocolAssetDustInWallet,
      protocolAssetDustInWalletLoading,
    });
  } else if (actionName === "transfer") {
    txns = await portfolioHelper.portfolioAction(actionName, {
      account: accountAddress,
      chainMetadata,
      zapOutPercentage: Number(zapOutPercentage),
      setTradingLoss,
      setTotalTradingLoss,
      setPlatformFee,
      slippage,
      recipient,
      onlyThisChain,
      protocolAssetDustInWallet,
      protocolAssetDustInWalletLoading,
    });
  } else if (actionName === "stake") {
    txns = await portfolioHelper.portfolioAction(actionName, {
      account: accountAddress,
      chainMetadata,
      setTradingLoss,
      setTotalTradingLoss,
      setPlatformFee,
      protocolAssetDustInWallet,
      protocolAssetDustInWalletLoading,
      onlyThisChain,
    });
  }

  return txns;
};
