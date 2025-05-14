import PendleMarketV3 from "../../lib/contracts/Pendle/PendleMarketV3.json" assert { type: "json" };
import PendlePrincipalToken from "../../lib/contracts/Pendle/PendlePrincipalToken.json" assert { type: "json" };
import ActionAddRemoveLiqV3 from "../../lib/contracts/Pendle/ActionAddRemoveLiqV3.json" assert { type: "json" };
import axios from "axios";
import { ethers } from "ethers";
import { PROVIDER } from "../../utils/general.js";
import axiosRetry from "axios-retry";
import { getContract, prepareTransaction } from "thirdweb";
import THIRDWEB_CLIENT from "../../utils/thirdweb.js";
import { approve, CHAIN_ID_TO_CHAIN } from "../../utils/general.js";
import BaseProtocol from "../BaseProtocol.js";

axiosRetry(axios, { retryDelay: axiosRetry.exponentialDelay });
export class BasePendlePT extends BaseProtocol {
  constructor(chain, chaindId, symbolList, mode, customParams) {
    super(chain, chaindId, symbolList, mode, customParams);
    this.protocolName = "pendle";
    this.protocolVersion = "0";
    this.assetDecimals = customParams.assetDecimals;
    this.PENDLE_TOKEN_ADDR_MAP = {
      8453: "0xa99f6e6785da0f5d6fb42495fe424bce029eeb3e",
      42161: "0x0c880f6761f1af8d9aa9c466984b80dab9a8c9e8",
    };
    this.assetContract = getContract({
      client: THIRDWEB_CLIENT,
      address: customParams.assetAddress,
      chain: CHAIN_ID_TO_CHAIN[this.chainId],
      abi: PendlePrincipalToken,
    });
    this.protocolContract = getContract({
      client: THIRDWEB_CLIENT,
      address: "0x888888888889758F76e7103c6CbF23ABbF58F946",
      chain: CHAIN_ID_TO_CHAIN[this.chainId],
      abi: ActionAddRemoveLiqV3,
    });
    this.stakeFarmContract = this.protocolContract;

    this.symbolOfBestTokenToZapOut = customParams.symbolOfBestTokenToZapOut;
    this.bestTokenAddressToZapOut = customParams.bestTokenAddressToZapOut;
    this.decimalOfBestTokenToZapOut = customParams.decimalOfBestTokenToZapOut;
    this._checkIfParamsAreSet();
  }
  rewards() {
    if (this.chainId === 8453) {
      return [
        {
          symbol: "pendle",
          priceId: {
            coinmarketcapApiId: 9481,
          },
          address: "0xa99f6e6785da0f5d6fb42495fe424bce029eeb3e",
          decimals: 18,
        },
      ];
    } else if (this.chainId === 42161) {
      return [
        {
          symbol: "arb",
          priceId: {
            coinmarketcapApiId: 11841,
          },
          address: "0x912ce59144191c1204e64559fe8253a0e49e6548",
          decimals: 18,
        },
        {
          symbol: "oarb",
          priceId: {
            coinmarketcapApiId: 11841,
          },
          address: "0x03b611858f8E8913F8DB7d9fDBF59e352b0c83E8",
          decimals: 18,
        },
        {
          symbol: "pendle",
          priceId: {
            coinmarketcapApiId: 9481,
          },
          address: "0x0c880f6761F1af8d9Aa9C466984b80DAb9a8c9e8",
          decimals: 18,
        },
      ];
    }
  }
  async pendingRewards(owner, tokenPricesMappingTable, updateProgress) {
    return {};
  }
  async isExpired() {
    this.marketContractInstance = new ethers.Contract(
      this.customParams.marketAddress,
      PendleMarketV3,
      PROVIDER(this.chain),
    );
    return await this.marketContractInstance.isExpired();
  }
  async customDeposit(
    owner,
    inputToken,
    bestTokenAddressToZapIn,
    amountToZapIn,
    bestTokenToZapInDecimal,
    tokenPricesMappingTable,
    slippage,
    updateProgress,
  ) {
    if (await this.isExpired()) {
      throw new Error(`${this.uniqueId()} is expired`);
    }
    const approveForZapInTxn = approve(
      bestTokenAddressToZapIn,
      this.protocolContract.address,
      amountToZapIn,
      updateProgress,
      this.chainId,
    );
    const resp = await axios.get(
      `https://api-v2.pendle.finance/core/v1/sdk/${this.chainId}/markets/${this.customParams.marketAddress}/swap`,
      {
        params: {
          receiver: owner,
          // slippage from the website is 0.5 (means 0.5%), so we need to divide it by 100 and pass it to Pendle (0.005 = 0.5%)
          slippage: slippage / 100,
          enableAggregator: true,
          tokenIn: bestTokenAddressToZapIn,
          tokenOut: this.customParams.assetAddress,
          amountIn: amountToZapIn,
        },
      },
    );
    const swapTxn = prepareTransaction({
      to: resp.data.tx.to,
      chain: CHAIN_ID_TO_CHAIN[this.chainId],
      client: THIRDWEB_CLIENT,
      data: resp.data.tx.data,
      extraGas: 600000n,
    });
    const latestPendleAssetPrice = await this._fetchPendleAssetPrice(() => {});
    const tradingLoss =
      Number(
        ethers.utils.formatUnits(resp.data.data.amountOut, this.assetDecimals),
      ) *
        latestPendleAssetPrice *
        Math.pow(10, this.assetDecimals) -
      Number(ethers.utils.formatUnits(amountToZapIn, bestTokenToZapInDecimal)) *
        tokenPricesMappingTable[inputToken];
    return [[approveForZapInTxn, swapTxn], tradingLoss];
  }

  async customClaim(owner, tokenPricesMappingTable, updateProgress) {
    const pendingRewards = await this.pendingRewards(
      owner,
      tokenPricesMappingTable,
      updateProgress,
    );
    return [[], pendingRewards];
  }

  async usdBalanceOf(owner, tokenPricesMappingTable) {
    const [userBalance, latestPendleAssetPrice] = await Promise.all([
      this.assetBalanceOf(owner),
      this._fetchPendleAssetPrice(() => {}),
    ]);
    return userBalance * latestPendleAssetPrice;
  }
  async assetUsdPrice(tokenPricesMappingTable) {
    return await this._fetchPendleAssetPrice(() => {});
  }

  async stakeBalanceOf(owner) {
    return ethers.BigNumber.from(0);
  }

  async _fetchPendleAssetPrice(updateProgress) {
    const resp = await axios.get(
      `https://api-v2.pendle.finance/core/v1/${this.chainId}/assets/prices`,
      {
        params: {
          addresses: this.assetContract.address,
          skip: 0,
        },
      },
    );
    return (
      resp.data.prices[this.assetContract.address.toLowerCase()] /
      Math.pow(10, this.assetDecimals)
    );
  }
  _getTheBestTokenAddressToZapIn(inputToken, tokenInAddress, tokenDecimals) {
    return [inputToken, tokenInAddress, tokenDecimals];
  }
  _getTheBestTokenAddressToZapOut() {
    // TODO: minor, but we can read the composition of VLP to get the cheapest token to zap in
    return [
      this.symbolOfBestTokenToZapOut,
      this.bestTokenAddressToZapOut,
      this.decimalOfBestTokenToZapOut,
    ];
  }
  _getRewardMetadata(address) {
    for (const rewardMetadata of this.rewards()) {
      if (rewardMetadata.address.toLowerCase() === address.toLowerCase()) {
        return rewardMetadata;
      }
    }
  }
  async lockUpPeriod() {
    return 0;
  }
  async _stake(amount, updateProgress) {
    return [];
  }
  async _unstake(owner, percentage, updateProgress) {
    // Convert percentage (0-1) to precise BigNumber with 18 decimals
    const percentagePrecision = 18;
    const percentageStr = percentage
      .toFixed(percentagePrecision)
      .replace(".", "");
    const percentageBN = ethers.BigNumber.from(percentageStr);
    const assetAmount = await this.assetBalanceOf(owner);
    const withdrawAmount = assetAmount
      .mul(percentageBN)
      .div(ethers.BigNumber.from("10").pow(percentagePrecision));
    return [[], withdrawAmount];
  }
  async customWithdrawAndClaim(
    owner,
    amount,
    slippage,
    tokenPricesMappingTable,
    updateProgress,
  ) {
    const approvePendleTxn = approve(
      this.assetContract.address,
      this.protocolContract.address,
      amount,
      updateProgress,
      this.chainId,
    );
    const [
      symbolOfBestTokenToZapOut,
      bestTokenAddressToZapOut,
      decimalOfBestTokenToZapOut,
    ] = this._getTheBestTokenAddressToZapOut();
    let burnTxn;
    let tradingLoss = 0;
    if (await this.isExpired()) {
      const zapOutResp = await axios.get(
        `https://api-v2.pendle.finance/core/v1/sdk/${this.chainId}/redeem`,
        {
          params: {
            receiver: owner,
            slippage: slippage / 100,
            enableAggregator: true,
            yt: this.customParams.ytAddress,
            tokenOut: bestTokenAddressToZapOut,
            amountIn: amount,
          },
        },
      );
      burnTxn = prepareTransaction({
        to: zapOutResp.data.tx.to,
        chain: CHAIN_ID_TO_CHAIN[this.chainId],
        client: THIRDWEB_CLIENT,
        data: zapOutResp.data.tx.data,
        extraGas: 750000n,
      });
      tradingLoss = 0;
    } else {
      const zapOutResp = await axios.get(
        `https://api-v2.pendle.finance/core/v1/sdk/${this.chainId}/markets/${this.customParams.marketAddress}/swap`,
        {
          params: {
            receiver: owner,
            // slippage from the website is 0.5 (means 0.5%), so we need to divide it by 100 and pass it to Pendle (0.005 = 0.5%)
            slippage: slippage / 100,
            enableAggregator: true,
            tokenIn: this.customParams.assetAddress,
            tokenOut: bestTokenAddressToZapOut,
            amountIn: amount,
          },
        },
      );
      burnTxn = prepareTransaction({
        to: zapOutResp.data.tx.to,
        chain: CHAIN_ID_TO_CHAIN[this.chainId],
        client: THIRDWEB_CLIENT,
        data: zapOutResp.data.tx.data,
        extraGas: 750000n,
      });
      const latestPendleAssetPrice = await this._fetchPendleAssetPrice(
        () => {},
      );
      const outputValue =
        Number(
          ethers.utils.formatUnits(
            zapOutResp.data.data.amountOut,
            decimalOfBestTokenToZapOut,
          ),
        ) * tokenPricesMappingTable[symbolOfBestTokenToZapOut];
      const currentValue =
        Number(ethers.utils.formatUnits(amount, this.assetDecimals)) *
        latestPendleAssetPrice *
        Math.pow(10, this.assetDecimals);
      tradingLoss = outputValue - currentValue;
    }

    return [
      [approvePendleTxn, burnTxn],
      symbolOfBestTokenToZapOut,
      bestTokenAddressToZapOut,
      decimalOfBestTokenToZapOut,
      zapOutResp.data.data.amountOut,
      tradingLoss,
    ];
  }
}
