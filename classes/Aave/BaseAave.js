import AToken from "../../lib/contracts/Aave/Atoken.json" assert { type: "json" };
import L2PoolInstance from "../../lib/contracts/Aave/L2PoolInstance.json" assert { type: "json" };
import { base } from "thirdweb/chains";
import axios from "axios";
import { ethers } from "ethers";
import { PROVIDER } from "../../utils/general.js";
import axiosRetry from "axios-retry";
import { getContract, prepareContractCall } from "thirdweb";
import THIRDWEB_CLIENT from "../../utils/thirdweb.js";
import { approve } from "../../utils/general.js";
import BaseProtocol from "../BaseProtocol.js";

axiosRetry(axios, { retryDelay: axiosRetry.exponentialDelay });
export class BaseAave extends BaseProtocol {
  constructor(chain, chaindId, symbolList, mode, customParams) {
    super(chain, chaindId, symbolList, mode, customParams);
    this.protocolName = "aave";
    this.protocolVersion = "v3";
    this.assetDecimals = customParams.assetDecimals;
    this.assetContract = getContract({
      client: THIRDWEB_CLIENT,
      address: customParams.assetAddress,
      chain: base,
      abi: AToken,
    });
    this.protocolContract = getContract({
      client: THIRDWEB_CLIENT,
      address: customParams.protocolAddress,
      chain: base,
      abi: L2PoolInstance,
    });
    this.stakeFarmContract = getContract({
      client: THIRDWEB_CLIENT,
      address: customParams.protocolAddress,
      chain: base,
      abi: L2PoolInstance,
    });
    this.assetContractInstance = new ethers.Contract(
      this.assetContract.address,
      AToken,
      PROVIDER(this.chain),
    );
    this.stakeFarmContractInstance = new ethers.Contract(
      this.stakeFarmContract.address,
      AToken,
      PROVIDER(this.chain),
    );

    this.symbolOfBestTokenToZapInOut = customParams.symbolOfBestTokenToZapInOut;
    this.zapInOutTokenAddress = customParams.zapInOutTokenAddress;
    this._checkIfParamsAreSet();
  }
  rewards() {
    return [];
  }
  async pendingRewards(owner, tokenPricesMappingTable, updateProgress) {
    return {};
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
    const approveTxn = approve(
      bestTokenAddressToZapIn,
      this.protocolContract.address,
      amountToZapIn,
      updateProgress,
      this.chainId,
    );
    const depositTxn = prepareContractCall({
      contract: this.protocolContract,
      method: "supply",
      params: [bestTokenAddressToZapIn, amountToZapIn, owner, 0],
    });
    return [[approveTxn, depositTxn], 0];
  }

  async customClaim(owner, tokenPricesMappingTable, updateProgress) {
    return [[], {}];
  }

  async usdBalanceOf(owner, tokenPricesMappingTable) {
    const [userBalance, latestPendleAssetPrice] = await Promise.all([
      this.assetBalanceOf(owner),
      this.assetUsdPrice(tokenPricesMappingTable),
    ]);

    return (
      (userBalance / Math.pow(10, this.assetDecimals)) * latestPendleAssetPrice
    );
  }
  async assetUsdPrice(tokenPricesMappingTable) {
    return tokenPricesMappingTable[this.symbolOfBestTokenToZapInOut];
  }

  async stakeBalanceOf(owner) {
    return ethers.BigNumber.from(0);
  }

  _getTheBestTokenAddressToZapIn(inputToken, tokenAddress, InputTokenDecimals) {
    return [inputToken, this.zapInOutTokenAddress, this.assetDecimals];
  }
  _getTheBestTokenAddressToZapOut() {
    return [
      this.symbolOfBestTokenToZapInOut,
      this.zapInOutTokenAddress,
      this.assetDecimals,
    ];
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
    const [
      symbolOfBestTokenToZapInOut,
      bestTokenAddressToZapInOut,
      assetDecimals,
    ] = this._getTheBestTokenAddressToZapOut();
    const burnTxn = prepareContractCall({
      contract: this.protocolContract,
      method: "withdraw",
      params: [bestTokenAddressToZapInOut, amount, owner],
    });
    const tradingLoss = 0;
    return [
      [burnTxn],
      symbolOfBestTokenToZapInOut,
      bestTokenAddressToZapInOut,
      assetDecimals,
      amount,
      tradingLoss,
    ];
  }
}
