import { ethers } from "ethers";
import { fetch1InchSwapData, oneInchAddress } from "../utils/oneInch.js";
import { PROVIDER } from "../utils/general.js";
import { arbitrum } from "thirdweb/chains";
import { ERC20_ABI } from "../node_modules/@etherspot/prime-sdk/dist/sdk/helpers/abi/ERC20_ABI.js";
import BaseUniswap from "./uniswapv3/BaseUniswap.js";
import assert from "assert";
import { getTokenDecimal, approve } from "../utils/general";

export default class BaseProtocol extends BaseUniswap {
  // arbitrum's Apollox is staked on PancakeSwap
  constructor(chaindId, symbolList, token2TokenIdMapping, mode, customParams) {
    super();
    this.protocolName = "placeholder";
    this.protocolVersion = "placeholder";
    this.assetContract = "placeholder";
    this.protocolContract = "placeholder";
    this.stakeFarmContract = "placeholder";
    // TODO: the totalSteps should be dynamically calculated
    this.totalSteps = 3;

    this.chainId = chaindId;
    this.symbolList = symbolList;
    this.token2TokenIdMapping = token2TokenIdMapping;
    this.mode = mode;
    this.customParams = customParams;
  }
  _checkIfParamsAreSet() {
    assert(this.protocolName !== "placeholder", "protocolName is not set");
    assert(
      this.protocolVersion !== "placeholder",
      "protocolVersion is not set",
    );
    assert(typeof this.assetContract === "object", "assetContract is not set");
    assert(
      typeof this.protocolContract === "object",
      "assetContract is not set",
    );
    assert(
      typeof this.stakeFarmContract === "object",
      "assetContract is not set",
    );
  }
  async userBalance(address) {
    throw new Error("Method 'userBalance()' must be implemented.");
  }
  async pendingRewards(address) {
    throw new Error("Method 'pendingRewards()' must be implemented.");
  }
  async zapIn(
    recipient,
    investmentAmountInThisPosition,
    inputToken,
    inputTokenAddress,
    slippage,
    tokenPricesMappingTable,
    updateProgress,
    existingInvestmentPositionsInThisChain,
  ) {
    if (this.mode === "single") {
      const [beforeZapInTxns, bestTokenAddressToZapIn, amountToZapIn] =
        await this._beforeZapIn(
          inputTokenAddress,
          investmentAmountInThisPosition,
          slippage,
          updateProgress,
        );
      const zapinTxns = await this.customZapIn(
        inputToken,
        bestTokenAddressToZapIn,
        amountToZapIn,
        tokenPricesMappingTable,
        slippage,
        updateProgress,
      );
      return beforeZapInTxns.concat(zapinTxns);
    } else if (this.mode === "LP") {
      // TODO: should meet all tokens listed in allowedZapInTokens
      throw new Error("Not implemented yet.");
      //   // TODO: it's just a pseudo code
      //   let txns = [];
      //   const [amountForToken0, amountForToken1] =
      //     this.calculateTokenAmountsForLPV2(
      //       inputToken,
      //       investmentAmountInThisPosition,
      //       tokenPricesMappingTable,
      //       decimalsOfToken0,
      //       decimalsOfToken1,
      //       minPrice,
      //       maxPrice,
      //     );
      //   const [swap0Txn, swap0EstimateAmount] = await this._swap(
      //     chosenToken,
      //     this.token0,
      //     ethers.utils.parseUnits(
      //       amountForToken0.toFixed(decimalsOfChosenToken),
      //       decimalsOfChosenToken,
      //     ),
      //     slippage,
      //   );
      //   const [swap1Txn, swap1EstimateAmount] = await this._swap(
      //     chosenToken,
      //     this.token1,
      //     ethers.utils.parseUnits(
      //       amountForToken1.toFixed(decimalsOfChosenToken),
      //       decimalsOfChosenToken,
      //     ),
      //     slippage,
      //   );
      //   txns.push(swap0Txn, swap1Txn);
      //   for (const [token, amount] of [
      //     [this.token0, swap0EstimateAmount],
      //     [this.token1, swap1EstimateAmount],
      //   ]) {
      //     const approveForCreateLpTxn = this._approve(
      //       token,
      //       liquidityManager,
      //       amount,
      //     );
      //     txns.push(approveForCreateLpTxn);
      //   }
      //   const mintOrIncreaseTxn = this._mintLPOrIncreaseLiquidity(
      //     swap0EstimateAmount,
      //     swap1EstimateAmount,
      //   );
      //   txns.push(mintOrIncreaseTxn);
      //   const finalTxns = this._customCallback(txns);
      //   return finalTxns;
    }
  }
  async zapOut(
    recipient,
    percentage,
    outputToken,
    slippage,
    tokenPricesMappingTable,
    updateProgress,
    customParams,
    existingInvestmentPositionsInThisChain,
  ) {
    const [zapOutTxns, withdrawTokenAndBalance] = await this.customZapOut(
      recipient,
      percentage,
      slippage,
      updateProgress,
      customParams,
    );
    const afterZapOutTxns = await this._afterZapOut(
      recipient,
      withdrawTokenAndBalance,
      outputToken,
      slippage,
      updateProgress,
    );
    return [...zapOutTxns, ...afterZapOutTxns];
  }
  async claimAndSwap(
    recipient,
    outputToken,
    slippage,
    updateProgress,
    existingInvestmentPositionsInThisChain,
  ) {
    const [claimTxns, claimedTokenAndBalance] = await this.claim(recipient);
    const txns = await this._afterZapOut(
      recipient,
      claimedTokenAndBalance,
      outputToken,
      slippage,
      updateProgress,
    );
    return [...claimTxns, ...txns];
  }
  async claim(recipient) {
    throw new Error("Method 'claim()' must be implemented.");
  }
  async _beforeZapIn(
    inputTokenAddress,
    investmentAmountInThisPosition,
    slippage,
    updateProgress,
  ) {
    let swapTxns = [];

    const tokenInstance = new ethers.Contract(
      inputTokenAddress,
      ERC20_ABI,
      PROVIDER,
    );
    const decimalsOfChosenToken = (await tokenInstance.functions.decimals())[0];
    const bestTokenAddressToZapIn = this._getTheBestTokenAddressToZapIn();
    let amountToZapIn = ethers.utils.parseUnits(
      investmentAmountInThisPosition.toFixed(decimalsOfChosenToken),
      decimalsOfChosenToken,
    );
    if (inputTokenAddress !== bestTokenAddressToZapIn) {
      const [swapTxn, swapEstimateAmount] = await this._swap(
        inputTokenAddress,
        inputTokenAddress,
        bestTokenAddressToZapIn,
        amountToZapIn,
        slippage,
        updateProgress,
      );
      amountToZapIn = Math.floor((swapEstimateAmount * (100 - slippage)) / 100);
      swapTxns.push(swapTxn);
    }
    const inputTokenDecimal = await getTokenDecimal(bestTokenAddressToZapIn);
    const approveForZapInTxn = approve(
      bestTokenAddressToZapIn,
      this.protocolContract.address,
      amountToZapIn,
      inputTokenDecimal,
      updateProgress,
    );
    return [
      [...swapTxns, approveForZapInTxn],
      bestTokenAddressToZapIn,
      amountToZapIn,
    ];
  }
  async _afterZapOut(
    recipient,
    withdrawTokenAndBalance,
    outputToken,
    slippage,
    updateProgress,
  ) {
    let txns = [];
    for (const [address, amount] of Object.entries(withdrawTokenAndBalance)) {
      if (amount === 0) {
        continue;
      }
      const tokenInstance = new ethers.Contract(address, ERC20_ABI, PROVIDER);
      const decimalsOfChosenToken = (
        await tokenInstance.functions.decimals()
      )[0];
      const approveTxn = approve(
        address,
        oneInchAddress,
        amount,
        decimalsOfChosenToken,
        updateProgress,
      );
      const swapTxnResult = await this._swap(
        recipient,
        address,
        outputToken,
        amount,
        slippage,
        updateProgress,
      );
      if (swapTxnResult === undefined) {
        continue;
      }
      txns = txns.concat([approveTxn, swapTxnResult[0]]);
    }
    return txns;
  }
  calculateTokensAddressAndBalances(
    withdrawTokenAndBalance,
    estimatedClaimTokensAddressAndBalance,
  ) {
    for (const [address, balance] of Object.entries(
      estimatedClaimTokensAddressAndBalance,
    )) {
      if (!withdrawTokenAndBalance[address]) {
        withdrawTokenAndBalance[address] = ethers.BigNumber.from(0);
      }

      // Ensure balance is a ethers.BigNumber
      const balanceBN = ethers.BigNumber.isBigNumber(balance)
        ? balance
        : ethers.BigNumber.from(balance);

      // Add balances
      withdrawTokenAndBalance[address] =
        withdrawTokenAndBalance[address].add(balanceBN);
    }
    return withdrawTokenAndBalance;
  }
  async _swap(
    walletAddress,
    fromTokenAddress,
    toTokenAddress,
    amount,
    slippage,
    updateProgress,
  ) {
    if (fromTokenAddress === toTokenAddress) {
      return;
    }
    const swapCallData = await fetch1InchSwapData(
      this.chainId,
      fromTokenAddress,
      toTokenAddress,
      amount,
      walletAddress,
      slippage,
    );
    if (swapCallData["data"] === undefined) {
      throw new Error("Swap data is undefined. Cannot proceed with swapping.");
    }
    if (swapCallData["toAmount"] === 0) {
      throw new Error("To amount is 0. Cannot proceed with swapping.");
    }
    updateProgress();
    return [
      {
        to: oneInchAddress,
        data: swapCallData["data"],
        chain: arbitrum,
      },
      swapCallData["toAmount"],
    ];
  }
  async customZapIn(amount) {
    throw new Error("Method 'customZapIn()' must be implemented.", amount);
  }
  async customZapOut(amount) {
    throw new Error(
      "Method 'customZapOut()' must be implemented. Also need to take claim() into account.",
      amount,
    );
  }
  _getTheBestTokenAddressToZapIn() {
    throw new Error(
      "Method '_getTheBestTokenAddressToZapIn()' must be implemented.",
    );
  }
}
