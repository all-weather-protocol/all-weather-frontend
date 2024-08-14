import ApolloXABI from "../../lib/contracts/ApolloX.json" assert { type: "json" };
import ERC20_ABI from "../../lib/contracts/ERC20.json" assert { type: "json" };
import { arbitrum } from "thirdweb/chains";
import axios from "axios";
import { ethers } from "ethers";
import { PROVIDER } from "../../utils/general.js";
import axiosRetry from "axios-retry";
import { getContract, prepareContractCall } from "thirdweb";
import THIRDWEB_CLIENT from "../../utils/thirdweb";
import { approve } from "../../utils/general.js";
import BaseProtocol from "../BaseProtocol.js";
// For PancakeSwap Stake
import SmartChefInitializable from "../../lib/contracts/PancakeSwap/SmartChefInitializable.json" assert { type: "json" };

axiosRetry(axios, { retryDelay: axiosRetry.exponentialDelay });
export class ApolloX extends BaseProtocol {
  constructor(chaindId, symbolList, token2TokenIdMapping, mode, customParams) {
    super(chaindId, symbolList, token2TokenIdMapping, mode, customParams);
    // arbitrum's Apollox is staked on PancakeSwap
    this.protocolName = "pancakeswap";
    this.protocolVersion = "0";
    this.assetContract = getContract({
      client: THIRDWEB_CLIENT,
      address: "0xbc76b3fd0d18c7496c0b04aea0fe7c3ed0e4d9c9",
      chain: arbitrum,
      abi: ERC20_ABI,
    });
    this.protocolContract = getContract({
      client: THIRDWEB_CLIENT,
      address: "0xB3879E95a4B8e3eE570c232B19d520821F540E48",
      chain: arbitrum,
      abi: ApolloXABI,
    });
    this.stakeFarmContract = getContract({
      client: THIRDWEB_CLIENT,
      // PancakeSwap Stake would change this address from time to time
      address: "0x97E3384447B52A63374EBA93cb36e02a20633926",
      chain: arbitrum,
      abi: SmartChefInitializable,
    });
    this.arbReward = "0x912ce59144191c1204e64559fe8253a0e49e6548";
    this._checkIfParamsAreSet();
  }
  async pendingRewards(recipient) {
    const stakeFarmContractInstance = new ethers.Contract(
      this.stakeFarmContract.address,
      SmartChefInitializable,
      PROVIDER,
    );
    const pendingReward = (
      await stakeFarmContractInstance.functions.pendingReward(recipient)
    )[0];
    return pendingReward;
  }
  async customZapIn(
    inputToken,
    bestTokenAddressToZapIn,
    amountToZapIn,
    tokenPricesMappingTable,
    slippage,
    updateProgress,
  ) {
    const latestPrice = await this._fetchAlpPrice(updateProgress);
    // on Arbitrum, we don't stake and then put ALP to pancakeswap for higher APY
    const estimatedAlpAmount =
      (tokenPricesMappingTable[inputToken] * amountToZapIn) / latestPrice;
    const minAlpAmount = Math.floor(
      ((estimatedAlpAmount / latestPrice) * (100 - slippage)) / 100,
    );
    const mintTxn = prepareContractCall({
      contract: this.protocolContract,
      method: "mintAlp", // <- this gets inferred from the contract
      params: [bestTokenAddressToZapIn, amountToZapIn, minAlpAmount, false],
    });
    const approveAlpTxn = approve(
      this.assetContract.address,
      this.stakeFarmContract.address,
      minAlpAmount,
      18,
      updateProgress,
    );
    const depositTxn = prepareContractCall({
      contract: this.stakeFarmContract,
      method: "deposit", // <- this gets inferred from the contract
      params: [minAlpAmount],
    });
    return [mintTxn, approveAlpTxn, depositTxn];
  }

  async customZapOut(
    recipient,
    percentage,
    slippage,
    updateProgress,
    customParams,
  ) {
    const stakeFarmContractInstance = new ethers.Contract(
      this.stakeFarmContract.address,
      SmartChefInitializable,
      PROVIDER,
    );
    const amount = Math.floor(
      (await stakeFarmContractInstance.functions.userInfo(recipient)).amount *
        percentage,
    );
    const withdrawTxn = prepareContractCall({
      contract: this.stakeFarmContract,
      method: "withdraw",
      params: [amount],
    });

    const approveAlpTxn = approve(
      this.assetContract.address,
      this.protocolContract.address,
      amount,
      18,
      updateProgress,
    );
    const latestPrice = await this._fetchAlpPrice(updateProgress);
    const estimatedZapOutUsdValue =
      ((amount / 1e18) * latestPrice * (100 - slippage)) / 100;
    // TODO: we might enable zap out to other token down the road
    const minOutAmount = Math.floor(estimatedZapOutUsdValue * 1e6);
    const bestTokenAddressToZapOut = this._getTheBestTokenAddressToZapOut();
    const burnTxn = prepareContractCall({
      contract: this.protocolContract,
      method: "burnAlp", // <- this gets inferred from the contract
      params: [bestTokenAddressToZapOut, amount, minOutAmount, recipient],
    });
    const withdrawTokenAndBalance =
      await this._calculateWithdrawTokenAndBalance(
        recipient,
        bestTokenAddressToZapOut,
        minOutAmount,
      );
    return [[withdrawTxn, approveAlpTxn, burnTxn], withdrawTokenAndBalance];
  }
  async claim(recipient) {
    const pendingReward = await this.pendingRewards(recipient);
    const claimTxn = prepareContractCall({
      contract: this.stakeFarmContract,
      method: "deposit",
      params: [0],
    });
    let rewardBalance = {};
    rewardBalance[this.arbReward] = pendingReward;
    return [[claimTxn], rewardBalance];
  }

  async _fetchAlpPrice(updateProgress) {
    const response = await axios({
      method: "post",
      url: "https://www.apollox.finance/bapi/futures/v1/public/future/symbol/history-price",
      headers: {
        "Content-Type": "application/json",
      },
      data: {
        channel: "ARB",
        currency: "alb",
        dataSize: 1,
      },
      referrer: "https://www.apollox.finance/en/ALP",
    });
    const latestPrice = response.data.data[0].price;
    updateProgress();
    return latestPrice;
  }
  _getTheBestTokenAddressToZapIn() {
    // TODO: minor, but we can read the composition of ALP to get the cheapest token to zap in
    const usdcBridgedAddress = "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8";
    return usdcBridgedAddress;
  }
  _getTheBestTokenAddressToZapOut() {
    // TODO: minor, but we can read the composition of ALP to get the cheapest token to zap in
    const usdcBridgedAddress = "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8";
    return usdcBridgedAddress;
  }
  async _calculateWithdrawTokenAndBalance(
    recipient,
    bestTokenAddressToZapOut,
    minOutAmount,
  ) {
    let withdrawTokenAndBalance = {};
    withdrawTokenAndBalance[bestTokenAddressToZapOut] = minOutAmount;
    const pendingRewards = await this.pendingRewards(recipient);
    withdrawTokenAndBalance[this.arbReward] = pendingRewards;
    return withdrawTokenAndBalance;
  }
}
