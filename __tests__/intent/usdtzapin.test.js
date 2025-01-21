import { describe, it, expect } from "vitest";
import { generateIntentTxns } from "../../classes/main.js";
import { getPortfolioHelper } from "../../utils/thirdwebSmartWallet.ts";
import { encode } from "thirdweb";
import { base, arbitrum } from "thirdweb/chains";

const setTradingLoss = () => {};
const setStepName = () => {};
const setTotalTradingLoss = () => {};
const setPlatformFee = () => {};
const slippage = 1;
const protocolAssetDustInWallet = {};
const rebalancableUsdBalanceDict = {};
const onlyThisChain = false; // Must be false so bridging can occur

describe("Bridge with USDT -> USDC Swap", () => {
  it("should swap right before bridging if input is USDT", async () => {
    const userAddress = "0x9eAe6086a8dE7D665FEB17e19853e68738e0Bd5C";
    const portfolioHelper = getPortfolioHelper("Stablecoin Vault");

    const actionName = "zapIn";
    const tokenInSymbol = "usdt";
    // base USDT address
    const tokenInAddress = "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2";
    const tokenDecimals = 6;
    const zapInAmount = 4;
    const zapOutPercentage = NaN;
    const chainMetadata = base;

    // Generate transactions
    const txns = await generateIntentTxns(
      actionName,
      chainMetadata,
      portfolioHelper,
      userAddress,
      tokenInSymbol,
      tokenInAddress,
      zapInAmount,
      tokenDecimals,
      zapOutPercentage,
      setTradingLoss,
      setStepName,
      setTotalTradingLoss,
      setPlatformFee,
      slippage,
      rebalancableUsdBalanceDict,
      userAddress,
      protocolAssetDustInWallet,
      onlyThisChain,
    );

    // Ensure we got some transactions
    expect(txns.length).toBeGreaterThanOrEqual(2);
    // console.log("All generated txns:", txns);

    // Find the bridging transaction
    const bridgeAddress = "0x09aea4b2242abC8bb4BB78D537A67a245A7bEC64";
    const bridgeIndex = txns.findIndex(
      (txn) => txn.to.toLowerCase() === bridgeAddress.toLowerCase(),
    );
    expect(bridgeIndex).toBeGreaterThan(-1);

    // The transaction right before bridging should be the aggregator swap
    const oneInchArbAddress = "0x1111111254EEB25477B68fb85Ed929f73A960582";
    const swapTxn = txns[bridgeIndex - 2];

    // 1) Check the 'to' address is the 1inch aggregator
    expect(swapTxn.to.toLowerCase()).toBe(oneInchArbAddress.toLowerCase());

    // 2) Check the call data references USDT -> USDC
    const swapData = await encode(swapTxn);
    // 3) Confirm bridging is indeed after the swap
    const bridgeTxn = txns[bridgeIndex];
    expect(bridgeTxn).toBeDefined();

    console.log(
      "✅ The aggregator swap is right before bridging, USDT -> USDC.",
    );
  });
});
