import YearnV3 from "../../lib/contracts/Yearn/YearnV3.json" assert { type: "json" };
import axios from "axios";
import { ethers } from "ethers";
import { PROVIDER } from "../../utils/general.js";
import axiosRetry from "axios-retry";
import { getContract, prepareContractCall } from "thirdweb";
import THIRDWEB_CLIENT from "../../utils/thirdweb";
import BaseProtocol from "../BaseProtocol.js";
import { approve, CHAIN_ID_TO_CHAIN } from "../../utils/general";

axiosRetry(axios, { retryDelay: axiosRetry.exponentialDelay });
export class YearnV3Vault extends BaseProtocol {
  constructor(chain, chaindId, symbolList, mode, customParams) {
    super(chain, chaindId, symbolList, mode, customParams);
    this.protocolName = "yearn";
    this.protocolVersion = "0";
    this.assetDecimals = 18;
    this.assetContract = getContract({
      client: THIRDWEB_CLIENT,
      address: "0x86dF48f8DC91504D2B3E360d67513f094Dfa6C84",
      chain: CHAIN_ID_TO_CHAIN[this.chainId],
      abi: YearnV3,
    });
    this.protocolContract = getContract({
      client: THIRDWEB_CLIENT,
      address: "0x86dF48f8DC91504D2B3E360d67513f094Dfa6C84",
      chain: CHAIN_ID_TO_CHAIN[this.chainId],
      abi: YearnV3,
    });
    // stakeFarmContract is null not used in this protocol
    this.stakeFarmContract = getContract({
      client: THIRDWEB_CLIENT,
      address: "0x86dF48f8DC91504D2B3E360d67513f094Dfa6C84",
      chain: CHAIN_ID_TO_CHAIN[this.chainId],
      abi: YearnV3,
    });
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
    const approveForZapInTxn = approve(
      bestTokenAddressToZapIn,
      this.protocolContract.address,
      amountToZapIn,
      updateProgress,
      this.chainId,
    );

    const depositTxn = prepareContractCall({
      contract: this.protocolContract,
      method: "deposit",
      params: [amountToZapIn, owner],
    });
    return [[approveForZapInTxn, depositTxn], 0];
  }
  async customClaim(owner, tokenPricesMappingTable, updateProgress) {
    return [[], {}];
  }
  async usdBalanceOf(owner, tokenPricesMappingTable) {
    const assetContractInstance = new ethers.Contract(
      this.assetContract.address,
      YearnV3,
      PROVIDER(this.chain),
    );
    const [userBalance, pricePerShare] = await Promise.all([
      assetContractInstance.functions.balanceOf(owner),
      assetContractInstance.functions.pricePerShare(),
    ]);
    return (
      (((userBalance * tokenPricesMappingTable["weth"]) / 1e18) *
        pricePerShare) /
      1e18
    );
  }
  _getTheBestTokenAddressToZapIn(inputToken, tokenAddress, InputTokenDecimals) {
    // TODO: minor, but we can read the composition of VLP to get the cheapest token to zap in
    const weth = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
    return ["weth", weth, 18];
  }
  _getTheBestTokenAddressToZapOut() {
    // TODO: minor, but we can read the composition of VLP to get the cheapest token to zap in
    const weth = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
    return ["weth", weth, 18];
  }
}
