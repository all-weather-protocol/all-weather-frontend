import Vault from "../../lib/contracts/Venus/Vault.json" assert { type: "json" };
import BaseProtocol from "../BaseProtocol";
import { getContract, prepareContractCall } from "thirdweb";
import THIRDWEB_CLIENT from "../../utils/thirdweb";
import { CHAIN_ID_TO_CHAIN, PROVIDER, approve } from "../../utils/general";
import { ethers } from "ethers";

export class Venus extends BaseProtocol {
  constructor(chain, chainId, symbolList, mode, customParams) {
    super(chain, chainId, symbolList, mode, customParams);

    this.protocolName = "venus";
    this.protocolVersion = "0";
    this.assetDecimals = customParams.assetDecimals;
    this.percentagePrecision = 18;
    this.exchangeRatePrecision = 18;

    if (!customParams.assetAddress) {
      throw new Error("Asset address is required");
    }

    this.assetContract = getContract({
      client: THIRDWEB_CLIENT,
      address: customParams.assetAddress,
      chain: CHAIN_ID_TO_CHAIN[this.chainId],
      abi: Vault,
    });
    this.protocolContract = getContract({
      client: THIRDWEB_CLIENT,
      address: customParams.protocolAddress,
      chain: CHAIN_ID_TO_CHAIN[this.chainId],
      abi: Vault,
    });
    this.stakeFarmContract = getContract({
      client: THIRDWEB_CLIENT,
      address: customParams.protocolAddress,
      chain: CHAIN_ID_TO_CHAIN[this.chainId],
      abi: Vault,
    });

    this.assetContractInstance = new ethers.Contract(
      customParams.assetAddress,
      Vault,
      PROVIDER(this.chain),
    );
    this.stakeFarmContractInstance = new ethers.Contract(
      this.stakeFarmContract.address,
      Vault,
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
      method: "mint",
      params: [amountToZapIn],
    });

    return [[approveTxn, depositTxn], 0];
  }

  async customClaim(owner, tokenPricesMappingTable, updateProgress) {
    return [[], {}];
  }

  async usdBalanceOf(owner, tokenPricesMappingTable) {
    try {
      const protocolContractInstance = new ethers.Contract(
        this.protocolContract.address,
        Vault,
        PROVIDER(this.chain),
      );
      const [userBalance, exchangeRate] = await Promise.all([
        protocolContractInstance.balanceOf(owner),
        protocolContractInstance.exchangeRateStored(),
      ]);
      const actualBalance = userBalance
        .mul(exchangeRate)
        .div(ethers.BigNumber.from(10).pow(this.exchangeRatePrecision));
      const balanceInUSDCStr = ethers.utils.formatUnits(
        actualBalance,
        this.assetDecimals,
      );
      const balanceInUSDC =
        Number(
          ethers.utils
            .parseUnits(balanceInUSDCStr, this.assetDecimals)
            .toString(),
        ) / Math.pow(10, this.assetDecimals);
      const usdcPrice =
        tokenPricesMappingTable[this.symbolOfBestTokenToZapInOut] || 1;

      return balanceInUSDC * usdcPrice;
    } catch (error) {
      console.error("Error in usdBalanceOf:", error);
      return 0;
    }
  }

  async assetUsdPrice(tokenPricesMappingTable) {
    return await this._fetchVusdPrice(() => {});
  }

  async _fetchVusdPrice(updateProgress) {
    const protocolContractInstance = new ethers.Contract(
      this.protocolContract.address,
      Vault,
      PROVIDER(this.chain),
    );
    const exchangeRate = await protocolContractInstance.exchangeRateStored();
    const priceStr = ethers.utils.formatUnits(
      exchangeRate,
      this.exchangeRatePrecision,
    );
    const vusdPrice =
      Number(
        ethers.utils
          .parseUnits(priceStr, this.exchangeRatePrecision)
          .toString(),
      ) / Math.pow(10, this.exchangeRatePrecision);

    return vusdPrice;
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
    const percentageStr = percentage
      .toFixed(this.percentagePrecision)
      .replace(".", "");
    const percentageBN = ethers.BigNumber.from(percentageStr);
    const protocolContractInstance = new ethers.Contract(
      this.protocolContract.address,
      Vault,
      PROVIDER(this.chain),
    );
    const assetAmount = await protocolContractInstance.balanceOf(owner);
    const withdrawAmount = assetAmount
      .mul(percentageBN)
      .div(ethers.BigNumber.from("10").pow(this.percentagePrecision));

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
      bestTokenAddressToZapOut,
      assetDecimals,
    ] = this._getTheBestTokenAddressToZapOut();

    const protocolContractInstance = new ethers.Contract(
      this.protocolContract.address,
      Vault,
      PROVIDER(this.chain),
    );

    const balance = await protocolContractInstance.balanceOf(owner);
    const percentageBN = ethers.utils.parseUnits(
      percentage.toString(),
      this.percentagePrecision,
    );
    const amountToWithdraw = balance
      .mul(percentageBN)
      .div(ethers.BigNumber.from(10).pow(this.percentagePrecision));
    const burnTxn = prepareContractCall({
      contract: this.protocolContract,
      method: "redeem",
      params: [amountToWithdraw],
    });
    const tradingLoss = 0;
    return [
      [burnTxn],
      symbolOfBestTokenToZapInOut,
      bestTokenAddressToZapOut,
      assetDecimals,
      amountToWithdraw,
      tradingLoss,
    ];
  }
}
