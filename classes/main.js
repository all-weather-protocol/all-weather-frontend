import { ethers } from "ethers";
import { toFixedString } from "../utils/general";

export const generateIntentTxns = async (
  actionName,
  portfolioHelper,
  accountAddress,
  tokenSymbol,
  tokenAddress,
  investmentAmount,
  tokenDecimals,
  zapOutPercentage,
  setProgress,
  setStepName,
  slippage,
  shouldClaimRewards,
  performanceFee,
) => {
  let txns;
  if (actionName === "zapIn") {
    txns = await portfolioHelper.portfolioAction("zapIn", {
      account: accountAddress,
      tokenInSymbol: tokenSymbol,
      tokenInAddress: tokenAddress,
      zapInAmount: ethers.utils.parseUnits(
        toFixedString(investmentAmount, tokenDecimals),
        tokenDecimals,
      ),
      progressCallback: (progressPercentage) => setProgress(progressPercentage),
      progressStepNameCallback: (stepName) => setStepName(stepName),
      slippage,
      shouldClaimRewards,
    });
  } else if (actionName === "zapOut") {
    txns = await portfolioHelper.portfolioAction("zapOut", {
      account: accountAddress,
      tokenOutSymbol: tokenSymbol,
      tokenOutAddress: tokenAddress,
      zapOutPercentage: Number(zapOutPercentage),
      progressCallback: (progressPercentage) => setProgress(progressPercentage),
      progressStepNameCallback: (stepName) => setStepName(stepName),
      slippage,
      shouldClaimRewards,
      performanceFee,
    });
  } else if (actionName === "claimAndSwap") {
    txns = await portfolioHelper.portfolioAction(actionName, {
      account: accountAddress,
      tokenOutAddress: tokenAddress,
      progressCallback: (progressPercentage) => setProgress(progressPercentage),
      progressStepNameCallback: (stepName) => setStepName(stepName),
      slippage,
    });
  } else if (actionName === "rebalance") {
    txns = await portfolioHelper.portfolioAction(actionName, {
      account: accountAddress,
      progressCallback: (progressPercentage) => setProgress(progressPercentage),
      progressStepNameCallback: (stepName) => setStepName(stepName),
      slippage,
      shouldClaimRewards,
      performanceFee,
    });
  }
  return txns;
};
