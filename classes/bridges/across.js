import { createAcrossClient } from "@across-protocol/app-sdk";
import { optimism, arbitrum, polygon, base } from "viem/chains";
import BaseBridge from "./BaseBridge";
import { prepareContractCall } from "thirdweb";
import THIRDWEB_CLIENT from "../../utils/thirdweb";
import {
  CHAIN_ID_TO_CHAIN,
  PROVIDER,
  getTokenDecimal,
} from "../../utils/general";
import SpokePool from "../../lib/contracts/Across/SpokePool.json";
import { getContract } from "thirdweb";
import { ethers } from "ethers";
import ERC20 from "../../lib/contracts/ERC20.json";
class AcrossBridge extends BaseBridge {
  static spokePoolMapping = {
    arbitrum: "0xe35e9842fceaCA96570B734083f4a58e8F7C5f2A",
    "arbitrum one": "0xe35e9842fceaCA96570B734083f4a58e8F7C5f2A",
    base: "0x09aea4b2242abC8bb4BB78D537A67a245A7bEC64",
    linea: "0x7E63A5f1a8F0B4d0934B2f2327DAED3F6bb2ee75",
    optimism: "0x6f26Bf09B1C792e3228e5467807a900A503c0281",
    op: "0x6f26Bf09B1C792e3228e5467807a900A503c0281",
    "op mainnet": "0x6f26Bf09B1C792e3228e5467807a900A503c0281",
    polygon: "0x9295ee1d8C5b022Be115A2AD3c30C72E34e7F096",
  };

  constructor() {
    super("across", false);
    this.sdk = createAcrossClient({
      integratorId: "0xaaff", // 2-byte hex string
      chains: [optimism, arbitrum, polygon, base],
    });
    this.isInitialized = false;
  }

  async getQuote(route, inputAmount) {
    return await this.sdk.getQuote({
      route,
      inputAmount,
    });
  }

  async getTokenDecimals(tokenAddress, chainId) {
    const tokenInstance = new ethers.Contract(
      tokenAddress,
      ERC20,
      PROVIDER(
        CHAIN_ID_TO_CHAIN[chainId].name
          .replace(" one", "")
          .replace(" mainnet", ""),
      ),
    );
    return await tokenInstance.decimals();
  }

  calculateFeeInToken(fee, decimals) {
    return ethers.utils.formatUnits(fee, decimals);
  }

  getBridgeAddress(chainId) {
    return AcrossBridge.spokePoolMapping[
      CHAIN_ID_TO_CHAIN[chainId].name.toLowerCase()
    ];
  }

  prepareBridgeTransaction(spokePoolContract, quote, owner, fee, fillDeadline) {
    return prepareContractCall({
      contract: spokePoolContract,
      method: "depositV3",
      params: [
        owner,
        owner,
        quote.deposit.inputToken,
        quote.deposit.outputToken,
        quote.deposit.inputAmount,
        quote.deposit.inputAmount - fee,
        quote.deposit.destinationChainId,
        "0x0000000000000000000000000000000000000000",
        quote.deposit.quoteTimestamp,
        fillDeadline,
        0,
        quote.deposit.message,
      ],
      extraGas: 150000n,
    });
  }

  async customBridgeTxn(
    owner,
    fromChainId,
    toChainId,
    fromToken,
    toToken,
    amount,
    updateProgress,
    tokenPrices,
  ) {
    const route = {
      originChainId: fromChainId,
      destinationChainId: toChainId,
      inputToken: fromToken,
      outputToken: toToken,
    };
    const quote = await this.getQuote(route, amount);
    const { feeInUSD, fee } = await this.getFeeCosts(
      quote,
      tokenPrices,
      fromToken,
      fromChainId,
    );
    updateProgress(`bridge-${fromChainId}-${toChainId}`, -Number(feeInUSD));

    const bridgeAddress = this.getBridgeAddress(fromChainId);
    const spokePoolContract = getContract({
      client: THIRDWEB_CLIENT,
      address: bridgeAddress,
      chain: CHAIN_ID_TO_CHAIN[fromChainId],
      abi: SpokePool,
    });

    const fillDeadlineBuffer = 18000;
    const fillDeadline = Math.round(Date.now() / 1000) + fillDeadlineBuffer;

    const bridgeTxn = this.prepareBridgeTransaction(
      spokePoolContract,
      quote,
      owner,
      fee,
      fillDeadline,
    );

    return [bridgeTxn, bridgeAddress, feeInUSD];
  }
  async getFeeCosts(quote, tokenPrices, fromToken, fromChainId) {
    const tokenDecimals = await this.getTokenDecimals(fromToken, fromChainId);
    const fee = quote.fees.totalRelayFee.total;
    const feeInToken = this.calculateFeeInToken(fee, tokenDecimals);
    const feeInUSD = feeInToken * tokenPrices;
    return { fee, feeInUSD };
  }
}

export default AcrossBridge;
