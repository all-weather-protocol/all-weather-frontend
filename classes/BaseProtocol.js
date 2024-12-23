import { ethers } from "ethers";
import { fetch1InchSwapData, oneInchAddress } from "../utils/oneInch.js";
import { CHAIN_ID_TO_CHAIN, PROVIDER, NULL_ADDRESS } from "../utils/general.js";
import ERC20_ABI from "../lib/contracts/ERC20.json" assert { type: "json" };
import BaseUniswap from "./uniswapv3/BaseUniswap.js";
import assert from "assert";
import THIRDWEB_CLIENT from "../utils/thirdweb";
import { approve } from "../utils/general";
import { prepareTransaction, prepareContractCall, getContract } from "thirdweb";

export default class BaseProtocol extends BaseUniswap {
  // arbitrum's Apollox is staked on PancakeSwap
  constructor(chain, chaindId, symbolList, mode, customParams) {
    super();
    this.protocolName = "placeholder";
    this.protocolVersion = "placeholder";
    this.assetDecimals = "placeholder";
    this.assetContract = "placeholder";
    this.protocolContract = "placeholder";
    this.stakeFarmContract = "placeholder";

    this.chain = chain;
    this.chainId = chaindId;
    this.symbolList = symbolList;
    this.mode = mode;
    this.customParams = customParams;
    assert(chain !== undefined, "chain is not set");
    assert(chaindId !== undefined, "chainId is not set");
    assert(symbolList !== undefined, "symbolList is not set");
    assert(mode !== undefined, "mode is not set");
    assert(customParams !== undefined, "customParams is not set");
  }
  uniqueId() {
    return `${this.chain}/${this.protocolName}/${
      this.protocolVersion
    }/${this.symbolList.join("-")}`;
  }
  toString() {
    // If the symbolList is too long, it will be truncated
    const maxSymbols = 2; // Define the maximum number of symbols to show
    const symbolList =
      this.symbolList.length > maxSymbols
        ? `${this.symbolList.slice(0, maxSymbols).join("-")}-...`
        : this.symbolList.join("-");
    return `${this.chain}/${this.protocolName}/${symbolList}`;
  }
  rewards() {
    throw new Error("Method 'rewards()' must be implemented.");
  }
  _checkIfParamsAreSet() {
    assert(this.protocolName !== "placeholder", "protocolName is not set");
    assert(
      this.protocolVersion !== "placeholder",
      "protocolVersion is not set",
    );
    assert(this.assetDecimals !== "placeholder", "assetDecimals is not set");
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

  getZapInFlowChartData(inputToken, tokenInAddress, weight) {
    const nodes = this._generateZapInNodes(inputToken, tokenInAddress);
    const edges = this._generateEdges(nodes, weight);
    this._enrichNodesWithMetadata(nodes);

    return { nodes, edges };
  }

  _generateZapInNodes(inputToken, tokenInAddress) {
    const nodes = [];

    if (this.mode === "single") {
      this._addSingleModeNodes(nodes, inputToken, tokenInAddress);
    } else if (this.mode === "LP") {
      this._addLPModeNodes(nodes, inputToken, tokenInAddress);
    }

    return nodes;
  }

  _addSingleModeNodes(nodes, inputToken, tokenInAddress) {
    const [bestTokenAddressToZapIn] = this._getTheBestTokenAddressToZapIn(
      tokenInAddress,
      18, // inputTokenDecimalsPlaceholder
    );

    if (
      bestTokenAddressToZapIn.toLowerCase() !== tokenInAddress.toLowerCase()
    ) {
      nodes.push(
        this._createSwapNode(
          inputToken,
          tokenInAddress,
          bestTokenAddressToZapIn,
        ),
      );
    }

    this._addCommonNodes(nodes);
  }

  _addLPModeNodes(nodes, inputToken, tokenInAddress) {
    const tokenMetadatas = this._getLPTokenPairesToZapIn();

    for (const [bestTokenSymbol, bestTokenAddressToZapIn] of tokenMetadatas) {
      if (
        bestTokenAddressToZapIn.toLowerCase() !==
        tokenInAddress.toLowerCase()
      ) {
        nodes.push({
          id: `${this.uniqueId()}-${inputToken}-${bestTokenSymbol}-swap`,
          name: `Swap ${inputToken} to ${bestTokenSymbol}`,
        });
      }
    }

    this._addCommonNodes(nodes);
  }

  _addCommonNodes(nodes) {
    const commonNodes = [
      {
        id: `${this.uniqueId()}-approve`,
        name: "Approve",
      },
      {
        id: `${this.uniqueId()}-deposit`,
        name: `Deposit ${this.symbolList.join("-")}`,
      },
      {
        id: `${this.uniqueId()}-stake`,
        name: "stake",
      },
    ];

    nodes.push(...commonNodes);
  }

  _createSwapNode(inputToken, tokenInAddress, bestTokenAddressToZapIn) {
    return {
      id: `${this.uniqueId()}-${tokenInAddress}-${bestTokenAddressToZapIn}-swap`,
      name: `Swap ${inputToken}`,
    };
  }

  _generateEdges(nodes, weight) {
    const edges = [];

    for (let i = 0; i < nodes.length - 1; i++) {
      edges.push({
        id: `edge-${this.uniqueId()}-${i}`,
        source: nodes[i].id,
        target: nodes[i + 1].id,
        data: { ratio: weight },
      });
    }

    return edges;
  }

  _enrichNodesWithMetadata(nodes) {
    for (const node of nodes) {
      node.chain = this.chain;
      node.symbolList = this.symbolList.map((symbol) =>
        symbol.replace("(bridged)", ""),
      );
      node.imgSrc = `/projectPictures/${this.protocolName}.webp`;
    }
  }
  getZapOutFlowChartData(outputToken, outputTokenAddress, weight) {
    function _autoGenerateEdges(uniqueId, nodes) {
      const edges = [];
      for (let i = 0; i < nodes.length - 1; i++) {
        edges.push({
          id: `edge-${uniqueId}-${i}`,
          source: nodes[i].id,
          target: nodes[i + 1].id,
          data: {
            ratio: weight,
          },
        });
      }
      return edges;
    }
    const nodes = [];

    if (this.mode === "single") {
      // decimals here doesn't matter
      for (const node of [
        {
          id: `${this.uniqueId()}-unstake`,
          name: "Unstake",
        },
        {
          id: `${this.uniqueId()}-withdraw`,
          name: `Withdraw ${this.symbolList.join("-")}`,
        },
        {
          id: `${this.uniqueId()}-claim`,
          name: "Claim Rewards",
        },
      ]) {
        nodes.push(node);
      }
      const [bestTokenSymbol, bestTokenAddressToZapIn, _] =
        this._getTheBestTokenAddressToZapOut();
      if (
        outputTokenAddress.toLowerCase() !==
        bestTokenAddressToZapIn.toLowerCase()
      ) {
        nodes.push({
          id: `${this.uniqueId()}-${bestTokenSymbol}-${outputToken}-swap`,
          name: `Swap ${bestTokenSymbol} to ${outputToken}`,
        });
      }
    } else if (this.mode === "LP") {
      for (const node of [
        {
          id: `${this.uniqueId()}-unstake`,
          name: "Unstake",
        },
        {
          id: `${this.uniqueId()}-withdraw`,
          name: `Withdraw ${this.symbolList.join("-")}`,
        },
        {
          id: `${this.uniqueId()}-claim`,
          name: "Claim Rewards",
        },
      ]) {
        nodes.push(node);
      }
      const tokenMetadatas = this._getLPTokenAddressesToZapOut();
      for (const [
        bestTokenSymbol,
        bestTokenAddressToZapOut,
        decimals,
      ] of tokenMetadatas) {
        if (
          bestTokenAddressToZapOut.toLowerCase() !==
          outputTokenAddress.toLowerCase()
        ) {
          nodes.push({
            id: `${this.uniqueId()}-${bestTokenSymbol}-${outputToken}-swap`,
            name: `Swap ${bestTokenSymbol} to ${outputToken}`,
          });
        }
      }
    }
    const edges = _autoGenerateEdges(this.uniqueId(), nodes);
    // add chain, category, protocol, symbol to the nodes
    for (const node of nodes) {
      node.chain = this.chain;
      node.symbolList = this.symbolList.map((symbol) =>
        symbol.replace("(bridged)", ""),
      );
      node.imgSrc = `/projectPictures/${this.protocolName}.webp`;
    }
    return {
      nodes,
      edges,
    };
  }
  getTransferFlowChartData(weight) {
    const nodes = [
      {
        id: `${this.uniqueId()}-unstake`,
        name: "Unstake",
      },
      {
        id: `${this.uniqueId()}-transfer`,
        name: "Transfer",
      },
    ];
    // add chain, category, protocol, symbol to the nodes
    for (const node of nodes) {
      node.chain = this.chain;
      node.symbolList = this.symbolList.map((symbol) =>
        symbol.replace("(bridged)", ""),
      );
      node.imgSrc = `/projectPictures/${this.protocolName}.webp`;
    }
    return {
      nodes,
      edges: [
        {
          id: `edge-${this.uniqueId()}-0`,
          source: `${this.uniqueId()}-unstake`,
          target: `${this.uniqueId()}-transfer`,
          data: {
            ratio: weight,
          },
        },
      ],
    };
  }
  getStakeFlowChartData() {
    const nodes = [
      {
        id: `${this.uniqueId()}-stake`,
        name: "stake",
      },
    ];
    // add chain, category, protocol, symbol to the nodes
    for (const node of nodes) {
      node.chain = this.chain;
      node.symbolList = this.symbolList.map((symbol) =>
        symbol.replace("(bridged)", ""),
      );
      node.imgSrc = `/projectPictures/${this.protocolName}.webp`;
    }
    return {
      nodes,
      edges: [],
    };
  }
  async usdBalanceOf(address, tokenPricesMappingTable) {
    throw new Error("Method 'usdBalanceOf()' must be implemented.");
  }
  async assetUsdBalanceOf(owner, tokenPricesMappingTable) {
    const balance = await this.assetBalanceOf(owner);
    const assetPrice = await this.assetUsdPrice(tokenPricesMappingTable);

    // Calculate: (balance * price) / (10 ** assetDecimals)
    return balance * assetPrice;
  }
  async stakeBalanceOf(address) {
    throw new Error("Method 'stakeBalanceOf()' must be implemented.");
  }
  async assetBalanceOf(recipient) {
    const assetContractInstance = new ethers.Contract(
      this.assetContract.address,
      ERC20_ABI,
      PROVIDER(this.chain),
    );
    const balance = (
      await assetContractInstance.functions.balanceOf(recipient)
    )[0];
    return balance;
  }
  async pendingRewards(recipient, tokenPricesMappingTable, updateProgress) {
    throw new Error("Method 'pendingRewards()' must be implemented.");
  }
  async assetUsdPrice(tokenPricesMappingTable) {
    throw new Error("Method 'assetUsdPrice()' must be implemented.");
  }
  async zapIn(
    recipient,
    chain,
    investmentAmountInThisPosition,
    inputToken,
    tokenInAddress,
    tokenDecimals,
    slippage,
    tokenPricesMappingTable,
    updateProgress,
  ) {
    if (this.mode === "single") {
      const [
        beforeZapInTxns,
        bestTokenAddressToZapIn,
        amountToZapIn,
        bestTokenToZapInDecimal,
      ] = await this._beforeDeposit(
        recipient,
        tokenInAddress,
        investmentAmountInThisPosition,
        slippage,
        updateProgress,
        inputToken,
        tokenDecimals,
        tokenPricesMappingTable,
      );
      await this._updateProgressAndWait(
        updateProgress,
        `${this.uniqueId()}-approve`,
        0,
      );
      const zapinTxns = await this.customDeposit(
        recipient,
        inputToken,
        bestTokenAddressToZapIn,
        amountToZapIn,
        bestTokenToZapInDecimal,
        tokenPricesMappingTable,
        slippage,
        updateProgress,
      );
      await this._updateProgressAndWait(
        updateProgress,
        `${this.uniqueId()}-stake`,
        0,
      );
      return beforeZapInTxns.concat(zapinTxns);
    } else if (this.mode === "LP") {
      const [beforeZapInTxns, tokenAmetadata, tokenBmetadata] =
        await this._beforeDepositLP(
          recipient,
          tokenInAddress,
          investmentAmountInThisPosition,
          slippage,
          updateProgress,
          inputToken,
          tokenDecimals,
          tokenPricesMappingTable,
        );
      await this._updateProgressAndWait(
        updateProgress,
        `${this.uniqueId()}-approve`,
        0,
      );
      const zapinTxns = await this.customDepositLP(
        recipient,
        tokenAmetadata,
        tokenBmetadata,
        tokenPricesMappingTable,
        slippage,
        updateProgress,
      );
      await this._updateProgressAndWait(
        updateProgress,
        `${this.uniqueId()}-deposit`,
        0,
      );
      await this._updateProgressAndWait(
        updateProgress,
        `${this.uniqueId()}-stake`,
        0,
      );
      return beforeZapInTxns.concat(zapinTxns);
    }
  }
  async zapOut(
    recipient,
    percentage,
    outputToken,
    outputTokenSymbol,
    outputTokenDecimals,
    slippage,
    tokenPricesMappingTable,
    updateProgress,
    customParams,
    existingInvestmentPositionsInThisChain,
  ) {
    let withdrawTxns = [];
    let redeemTxns = [];
    let withdrawTokenAndBalance = {};
    if (this.mode === "single") {
      const [
        withdrawTxnsForSingle,
        symbolOfBestTokenToZapOut,
        bestTokenAddressToZapOut,
        decimalOfBestTokenToZapOut,
        minOutAmount,
      ] = await this.customWithdrawAndClaim(
        recipient,
        percentage,
        slippage,
        tokenPricesMappingTable,
        updateProgress,
      );
      const [redeemTxnsForSingle, withdrawTokenAndBalanceForSingle] =
        await this._calculateWithdrawTokenAndBalance(
          recipient,
          symbolOfBestTokenToZapOut,
          bestTokenAddressToZapOut,
          decimalOfBestTokenToZapOut,
          minOutAmount,
          tokenPricesMappingTable,
          updateProgress,
        );
      withdrawTxns = withdrawTxnsForSingle;
      redeemTxns = redeemTxnsForSingle;
      withdrawTokenAndBalance = withdrawTokenAndBalanceForSingle;
    } else if (this.mode === "LP") {
      const [withdrawLPTxns, tokenMetadatas, minPairAmounts] =
        await this.customWithdrawLPAndClaim(
          recipient,
          percentage,
          slippage,
          tokenPricesMappingTable,
          updateProgress,
        );
      const [redeemTxnsFromLP, withdrawTokenAndBalanceFromLP] =
        await this._calculateWithdrawLPTokenAndBalance(
          recipient,
          tokenMetadatas,
          minPairAmounts,
          tokenPricesMappingTable,
          updateProgress,
        );
      withdrawTxns = withdrawLPTxns;
      redeemTxns = redeemTxnsFromLP;
      withdrawTokenAndBalance = withdrawTokenAndBalanceFromLP;
    }
    const batchSwapTxns = await this._batchSwap(
      recipient,
      withdrawTokenAndBalance,
      outputToken,
      outputTokenSymbol,
      outputTokenDecimals,
      slippage,
      tokenPricesMappingTable,
      updateProgress,
    );
    if (redeemTxns.length === 0) {
      return [...withdrawTxns, ...batchSwapTxns];
    } else {
      return [...withdrawTxns, ...redeemTxns, ...batchSwapTxns];
    }
  }
  async claimAndSwap(
    recipient,
    outputToken,
    slippage,
    tokenPricesMappingTable,
    updateProgress,
    existingInvestmentPositionsInThisChain,
  ) {
    const [claimTxns, claimedTokenAndBalance] = await this.customClaim(
      recipient,
      tokenPricesMappingTable,
      updateProgress,
    );
    const txns = await this._batchSwap(
      recipient,
      claimedTokenAndBalance,
      outputToken,
      slippage,
      tokenPricesMappingTable,
      updateProgress,
    );
    return [...claimTxns, ...txns];
  }

  async transfer(owner, percentage, updateProgress, recipient) {
    let amount;
    let unstakeTxnsOfThisProtocol;
    if (this.mode === "single") {
      [unstakeTxnsOfThisProtocol, amount] = await this._unstake(
        owner,
        percentage,
        updateProgress,
      );
    } else if (this.mode === "LP") {
      [unstakeTxnsOfThisProtocol, amount] = await this._unstakeLP(
        owner,
        percentage,
        updateProgress,
      );
    } else {
      throw new Error("Invalid mode for transfer");
    }

    // Ensure amount is valid
    if (!amount || amount.toString() === "0") {
      throw new Error("No amount available to transfer");
    }

    const transferTxn = prepareContractCall({
      contract: this.assetContract,
      method: "transfer",
      params: [recipient, amount],
    });
    this._updateProgressAndWait(
      updateProgress,
      `${this.uniqueId()}-transfer`,
      0,
    );
    return [...unstakeTxnsOfThisProtocol, transferTxn];
  }
  async stake(protocolAssetDustInWallet, updateProgress) {
    let stakeTxns = [];
    const amount =
      protocolAssetDustInWallet[this.assetContract.address].assetBalance;
    if (amount.toString() === "0") {
      return [];
    }
    if (this.mode === "single") {
      stakeTxns = await this._stake(amount, updateProgress);
    } else if (this.mode === "LP") {
      stakeTxns = await this._stakeLP(amount, updateProgress);
    } else {
      throw new Error("Invalid mode for stake");
    }
    await this._updateProgressAndWait(
      updateProgress,
      `${this.uniqueId()}-stake`,
      0,
    );
    return stakeTxns;
  }
  async customDeposit(
    recipient,
    inputToken,
    bestTokenAddressToZapIn,
    amountToZapIn,
    bestTokenToZapInDecimal,
    tokenPricesMappingTable,
    slippage,
    updateProgress,
  ) {
    throw new Error("Method 'customDeposit()' must be implemented.", amount);
  }
  async customWithdrawAndClaim(
    owner,
    percentage,
    slippage,
    tokenPricesMappingTable,
    updateProgress,
  ) {
    const [unstakeTxns, unstakedAmount] = await this._unstake(
      owner,
      percentage,
      updateProgress,
    );
    const [
      withdrawAndClaimTxns,
      symbolOfBestTokenToZapOut,
      bestTokenAddressToZapOut,
      decimalOfBestTokenToZapOut,
      minTokenOut,
    ] = await this._withdrawAndClaim(
      owner,
      unstakedAmount,
      slippage,
      tokenPricesMappingTable,
      updateProgress,
    );
    return [
      [...unstakeTxns, ...withdrawAndClaimTxns],
      symbolOfBestTokenToZapOut,
      bestTokenAddressToZapOut,
      decimalOfBestTokenToZapOut,
      minTokenOut,
    ];
  }
  async customWithdrawLPAndClaim(
    owner,
    percentage,
    slippage,
    tokenPricesMappingTable,
    updateProgress,
  ) {
    const [unstakeTxns, unstakedAmount] = await this._unstakeLP(
      owner,
      percentage,
      updateProgress,
    );
    const [withdrawAndClaimTxns, tokenMetadatas, minPairAmounts] =
      await this._withdrawLPAndClaim(
        owner,
        unstakedAmount,
        slippage,
        tokenPricesMappingTable,
        updateProgress,
      );
    return [
      [...unstakeTxns, ...withdrawAndClaimTxns],
      tokenMetadatas,
      minPairAmounts,
    ];
  }

  async customClaim(owner, tokenPricesMappingTable, updateProgress) {
    throw new Error("Method 'customClaim()' must be implemented.");
  }

  customRedeemVestingRewards(pendingRewards) {
    return [];
  }

  _getTheBestTokenAddressToZapIn(inputToken, InputTokenDecimals) {
    throw new Error(
      "Method '_getTheBestTokenAddressToZapIn()' must be implemented.",
    );
  }
  _getLPTokenPairesToZapIn() {
    return this.customParams.lpTokens;
  }
  _getTheBestTokenAddressToZapOut() {
    throw new Error(
      "Method '_getTheBestTokenAddressToZapOut()' must be implemented.",
    );
  }
  _getLPTokenAddressesToZapOut() {
    return this._getLPTokenPairesToZapIn();
  }
  async _beforeDeposit(
    recipient,
    tokenInAddress,
    investmentAmountInThisPosition,
    slippage,
    updateProgress,
    inputToken,
    tokenDecimals,
    tokenPricesMappingTable,
  ) {
    let swapTxns = [];
    const [bestTokenSymbol, bestTokenAddressToZapIn, bestTokenToZapInDecimal] =
      this._getTheBestTokenAddressToZapIn(
        inputToken,
        tokenInAddress,
        tokenDecimals,
      );
    let amountToZapIn = investmentAmountInThisPosition;
    if (
      tokenInAddress.toLowerCase() !== bestTokenAddressToZapIn.toLowerCase()
    ) {
      const [swapTxn, swapEstimateAmount] = await this._swap(
        recipient,
        tokenInAddress,
        bestTokenAddressToZapIn,
        amountToZapIn,
        slippage,
        updateProgress,
        inputToken,
        tokenDecimals,
        bestTokenSymbol,
        bestTokenToZapInDecimal,
        tokenPricesMappingTable,
      );
      amountToZapIn = Math.floor((swapEstimateAmount * (100 - slippage)) / 100);
      swapTxns.push(swapTxn);
    }
    return [
      swapTxns,
      bestTokenAddressToZapIn,
      amountToZapIn,
      bestTokenToZapInDecimal,
    ];
  }
  async _beforeDepositLP(
    recipient,
    tokenInAddress,
    investmentAmountInThisPosition,
    slippage,
    updateProgress,
    inputToken,
    tokenDecimals,
    tokenPricesMappingTable,
  ) {
    // Validate and get token pairs
    const tokenMetadatas = this._getLPTokenPairesToZapIn();
    if (tokenMetadatas.length !== 2) {
      throw new Error(
        `Currently only support 2 tokens in LP, but got ${tokenMetadatas.length}`,
      );
    }

    // Calculate initial ratios
    const lpTokenRatio = await this._calculateTokenAmountsForLP(tokenMetadatas);
    const sumOfLPTokenRatio = lpTokenRatio.reduce(
      (acc, value) => acc.add(value),
      ethers.BigNumber.from(0),
    );

    // Process swaps for each token
    const [swapTxns, amountsAfterSwap] = await this._processTokenSwaps(
      recipient,
      tokenInAddress,
      inputToken,
      tokenDecimals,
      tokenMetadatas,
      lpTokenRatio,
      sumOfLPTokenRatio,
      investmentAmountInThisPosition,
      slippage,
      updateProgress,
      tokenPricesMappingTable,
    );

    // Balance token ratios
    const balancedAmounts = this._balanceTokenRatios(
      amountsAfterSwap,
      tokenMetadatas,
      lpTokenRatio,
    );

    // Format final metadata
    const swappedTokenMetadatas = tokenMetadatas.map((metadata, index) => [
      ...metadata.slice(0, 3),
      balancedAmounts[index],
    ]);

    return [swapTxns, swappedTokenMetadatas[0], swappedTokenMetadatas[1]];
  }

  async _processTokenSwaps(
    recipient,
    tokenInAddress,
    inputToken,
    tokenDecimals,
    tokenMetadatas,
    lpTokenRatio,
    sumOfLPTokenRatio,
    investmentAmount,
    slippage,
    updateProgress,
    tokenPricesMappingTable,
  ) {
    const swapTxns = [];
    const amountsAfterSwap = [];

    for (const [
      index,
      [bestTokenSymbol, bestTokenAddress, bestTokenToZapInDecimal],
    ] of tokenMetadatas.entries()) {
      let amountToZapIn = investmentAmount
        .mul(lpTokenRatio[index])
        .div(sumOfLPTokenRatio);

      if (tokenInAddress.toLowerCase() !== bestTokenAddress.toLowerCase()) {
        const [swapTxn, swapEstimateAmount] = await this._swap(
          recipient,
          tokenInAddress,
          bestTokenAddress,
          amountToZapIn,
          slippage,
          updateProgress,
          inputToken,
          tokenDecimals,
          bestTokenSymbol,
          bestTokenToZapInDecimal,
          tokenPricesMappingTable,
        );

        amountToZapIn = ethers.BigNumber.from(swapEstimateAmount)
          .mul((100 - slippage) * 10000)
          .div(100 * 10000);
        swapTxns.push(swapTxn);
      }

      amountsAfterSwap.push(amountToZapIn);
    }

    return [swapTxns, amountsAfterSwap];
  }

  _balanceTokenRatios(amounts, tokenMetadatas, lpTokenRatio) {
    const precision = 1000000000;

    // Calculate current and target ratios
    const currentRatio =
      Number(ethers.utils.formatUnits(amounts[0], tokenMetadatas[0][2])) /
      Number(ethers.utils.formatUnits(amounts[1], tokenMetadatas[1][2]));
    const targetRatio = lpTokenRatio[0] / lpTokenRatio[1];

    // Convert to BigNumber for precise calculations
    const currentRatioBN = ethers.BigNumber.from(
      Math.floor(currentRatio * precision),
    );
    const targetRatioBN = ethers.BigNumber.from(
      Math.floor(targetRatio * precision),
    );

    // Adjust amounts to match target ratio
    const balancedAmounts = [...amounts];
    if (currentRatioBN.gt(targetRatioBN)) {
      balancedAmounts[0] = amounts[0].mul(targetRatioBN).div(currentRatioBN);
    } else {
      balancedAmounts[1] = amounts[1].mul(currentRatioBN).div(targetRatioBN);
    }

    return balancedAmounts;
  }
  async _batchSwap(
    recipient,
    withdrawTokenAndBalance,
    outputToken,
    outputTokenSymbol,
    outputTokenDecimals,
    slippage,
    tokenPricesMappingTable,
    updateProgress,
  ) {
    let txns = [];
    for (const [address, tokenMetadata] of Object.entries(
      withdrawTokenAndBalance,
    )) {
      const amount = tokenMetadata.balance;
      const fromTokenSymbol = tokenMetadata.symbol;
      const fromTokenDecimals = tokenMetadata.decimals;
      if (
        amount.toString() === "0" ||
        amount === 0 ||
        tokenMetadata.vesting === true ||
        // if usd value of this token is less than 1, then it's easy to suffer from high slippage
        tokenMetadata.usdDenominatedValue < 1
      ) {
        continue;
      }
      const approveTxn = approve(
        address,
        oneInchAddress,
        amount,
        updateProgress,
        this.chainId,
      );
      const swapTxnResult = await this._swap(
        recipient,
        address,
        outputToken,
        amount,
        slippage,
        updateProgress,
        fromTokenSymbol,
        fromTokenDecimals,
        outputTokenSymbol,
        outputTokenDecimals,
        tokenPricesMappingTable,
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
    fromToken,
    fromTokenDecimals,
    toTokenSymbol,
    toTokenDecimals,
    tokenPricesMappingTable,
  ) {
    if (fromTokenAddress.toLowerCase() === toTokenAddress.toLowerCase()) {
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
    const normalizedInputAmout = ethers.utils.formatUnits(
      amount,
      fromTokenDecimals,
    );
    const normalizedOutputAmount = ethers.utils.formatUnits(
      swapCallData["toAmount"],
      toTokenDecimals,
    );
    const tradingLoss =
      Number(normalizedOutputAmount) * tokenPricesMappingTable[toTokenSymbol] -
      Number(normalizedInputAmout) * tokenPricesMappingTable[fromToken];
    // If you need to wait for the progress update
    await this._updateProgressAndWait(
      updateProgress,
      `${this.uniqueId()}-${fromToken}-${toTokenSymbol}-swap`,
      tradingLoss,
    );

    return [
      prepareTransaction({
        to: oneInchAddress,
        chain: CHAIN_ID_TO_CHAIN[this.chainId],
        client: THIRDWEB_CLIENT,
        data: swapCallData["data"],
      }),
      swapCallData["toAmount"],
    ];
  }
  async _calculateWithdrawTokenAndBalance(
    recipient,
    symbolOfBestTokenToZapOut,
    bestTokenAddressToZapOut,
    decimalOfBestTokenToZapOut,
    minOutAmount,
    tokenPricesMappingTable,
    updateProgress,
  ) {
    let withdrawTokenAndBalance = {};
    withdrawTokenAndBalance[bestTokenAddressToZapOut] = {
      symbol: symbolOfBestTokenToZapOut,
      balance: minOutAmount,
      usdDenominatedValue:
        (tokenPricesMappingTable[symbolOfBestTokenToZapOut] * minOutAmount) /
        Math.pow(10, decimalOfBestTokenToZapOut),
      decimals: decimalOfBestTokenToZapOut,
    };
    const pendingRewards = await this.pendingRewards(
      recipient,
      tokenPricesMappingTable,
      updateProgress,
    );
    const redeemTxns = this.customRedeemVestingRewards(pendingRewards);
    for (const [address, metadata] of Object.entries(pendingRewards)) {
      if (withdrawTokenAndBalance[address]) {
        withdrawTokenAndBalance[address].balance = withdrawTokenAndBalance[
          address
        ].balance.add(metadata.balance);
        withdrawTokenAndBalance[address].usdDenominatedValue =
          (tokenPricesMappingTable[withdrawTokenAndBalance[metadata.symbol]] *
            withdrawTokenAndBalance[address].balance) /
          Math.pow(10, withdrawTokenAndBalance[address].decimals);
      } else {
        withdrawTokenAndBalance[address] = metadata;
      }
    }
    return [redeemTxns, withdrawTokenAndBalance];
  }
  async _calculateWithdrawLPTokenAndBalance(
    recipient,
    tokenMetadatas,
    minPairAmounts,
    tokenPricesMappingTable,
    updateProgress,
  ) {
    let withdrawTokenAndBalance = {};
    for (const [index, tokenMetadata] of tokenMetadatas.entries()) {
      const [
        symbolOfBestTokenToZapOut,
        bestTokenAddressToZapOut,
        decimalOfBestTokenToZapOut,
      ] = tokenMetadata;
      const minOutAmount = minPairAmounts[index];
      if (minOutAmount.toString() === "0" || minOutAmount === 0) {
        continue;
      }
      withdrawTokenAndBalance[bestTokenAddressToZapOut] = {
        symbol: symbolOfBestTokenToZapOut,
        balance: minOutAmount,
        usdDenominatedValue:
          (tokenPricesMappingTable[symbolOfBestTokenToZapOut] * minOutAmount) /
          Math.pow(10, decimalOfBestTokenToZapOut),
        decimals: decimalOfBestTokenToZapOut,
      };
    }
    const pendingRewards = await this.pendingRewards(
      recipient,
      tokenPricesMappingTable,
      updateProgress,
    );
    const redeemTxns = this.customRedeemVestingRewards(pendingRewards);
    for (const [address, metadata] of Object.entries(pendingRewards)) {
      if (withdrawTokenAndBalance[address]) {
        withdrawTokenAndBalance[address].balance = withdrawTokenAndBalance[
          address
        ].balance.add(metadata.balance);
        withdrawTokenAndBalance[address].usdDenominatedValue =
          (tokenPricesMappingTable[withdrawTokenAndBalance[metadata.symbol]] *
            withdrawTokenAndBalance[address].balance) /
          Math.pow(10, withdrawTokenAndBalance[address].decimals);
      } else {
        withdrawTokenAndBalance[address] = metadata;
      }
    }
    return [redeemTxns, withdrawTokenAndBalance];
  }
  async _stake(amount, updateProgress) {
    throw new Error("Method '_stake()' must be implemented.");
  }
  async _stakeLP(amount, updateProgress) {
    throw new Error("Method '_stakeLP()' must be implemented.");
  }
  async _unstake(owner, percentage, updateProgress) {
    throw new Error("Method '_unstake()' must be implemented.");
  }
  async _unstakeLP(owner, percentage, updateProgress) {
    throw new Error("Method '_unstakeLP()' must be implemented.");
  }
  async _withdrawAndClaim(
    owner,
    withdrawAmount,
    slippage,
    tokenPricesMappingTable,
    updateProgress,
  ) {
    throw new Error("Method '_withdrawAndClaim()' must be implemented.");
  }
  async _withdrawLPAndClaim(
    owner,
    amount,
    slippage,
    tokenPricesMappingTable,
    updateProgress,
  ) {
    throw new Error("Method '_withdrawLPAndClaim()' must be implemented.");
  }
  async _calculateTokenAmountsForLP(tokenMetadatas) {
    throw new Error(
      'Method "_calculateTokenAmountsForLP()" must be implemented.',
    );
  }
  mul_with_slippage_in_bignumber_format(amount, slippage) {
    // Convert amount to BigNumber if it isn't already
    const amountBN = ethers.BigNumber.isBigNumber(amount)
      ? amount
      : ethers.BigNumber.from(String(amount));

    // Convert slippage to basis points (e.g., 0.5% -> 50)
    const slippageBasisPoints = ethers.BigNumber.from(
      Math.floor(slippage * 100),
    );

    // Calculate (amount * (10000 - slippageBasisPoints)) / 10000
    return amountBN
      .mul(ethers.BigNumber.from(10000).sub(slippageBasisPoints))
      .div(10000);
  }
  async lockUpPeriod(address) {
    throw new Error("Method 'lockUpPeriod()' must be implemented.");
  }
  async approve(tokenAddress, spenderAddress, amount, updateProgress, chainId) {
    if (typeof amount !== "object") {
      amount = ethers.BigNumber.from(amount);
    }
    const approvalAmount = amount;
    if (approvalAmount === 0) {
      throw new Error("Approval amount is 0. Cannot proceed with approving.");
    }
    if (spenderAddress === NULL_ADDRESS) {
      throw new Error(
        "Spender address is null. Cannot proceed with approving.",
      );
    }
    const contractCall = prepareContractCall({
      contract: getContract({
        client: THIRDWEB_CLIENT,
        address: tokenAddress,
        chain: CHAIN_ID_TO_CHAIN[chainId],
        abi: ERC20_ABI,
      }),
      method: "approve", // <- this gets inferred from the contract
      params: [spenderAddress, approvalAmount],
    });
    await this._updateProgressAndWait(
      updateProgress,
      `${this.uniqueId()}-approve`,
      0,
    );
    return contractCall;
  }
  async _updateProgressAndWait(updateProgress, nodeId, tradingLoss) {
    await new Promise((resolve) => {
      updateProgress(nodeId, tradingLoss);
      // Use setTimeout to ensure the state update is queued
      setTimeout(resolve, 30);
    });
  }
}
