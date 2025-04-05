import { createAcrossClient } from "@across-protocol/app-sdk";
import { optimism, arbitrum, polygon, base } from "viem/chains";
import BaseBridge from "./BaseBridge";
import { prepareContractCall } from "thirdweb";
import THIRDWEB_CLIENT from "../../utils/thirdweb";
import { CHAIN_ID_TO_CHAIN, PROVIDER, getTokenDecimal } from "../../utils/general";
import SpokePool from "../../lib/contracts/Across/SpokePool.json";
import { getContract } from "thirdweb";
import { ethers } from "ethers";
import ERC20 from "../../lib/contracts/ERC20.json";
import { PriceService } from "../TokenPriceService";
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

  static ethAddress = [
    "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    "0x4200000000000000000000000000000000000006",
  ]
  constructor() {
    super("across");
    this.sdk = createAcrossClient({
      integratorId: "0xaaff", // 2-byte hex string
      chains: [optimism, arbitrum, polygon, base],
    });
    this.isInitialized = false;
    this.feeCosts = null;
  }

  async init() {
    return;
  }

  async fetchFeeCosts(
    account,
    fromChainId,
    toChainId,
    inputToken,
    targetToken,
    inputAmount,
  ) {
    const route = {
      originChainId: fromChainId,
      destinationChainId: toChainId,
      inputToken: inputToken,
      outputToken: targetToken,
    };
    const quote = await this.sdk.getQuote({
      route,
      inputAmount: inputAmount,
    });
    const tokenDecimal = await getTokenDecimal(quote.deposit.inputToken, CHAIN_ID_TO_CHAIN[fromChainId].name);
    const feeInToken = ethers.utils.formatUnits(
      quote.fees.totalRelayFee.total,
      tokenDecimal,
    );
    if (AcrossBridge.ethAddress.includes(quote.deposit.inputToken)) {
      const priceService = new PriceService(process.env.NEXT_PUBLIC_API_URL);
      const chainName = CHAIN_ID_TO_CHAIN[fromChainId].name.toLowerCase().includes("op") ?
      "optimism" : CHAIN_ID_TO_CHAIN[fromChainId].name.toLowerCase().replace(" one", "").replace(" mainnet", "");
      const tokenPrice = await priceService.fetchPrice(
        quote.deposit.inputToken,
        {
          geckoterminal: {
            chain: chainName,
            address: quote.deposit.inputToken,
          },
        },
      );
      this.feeCosts = feeInToken * tokenPrice;
    } else {
      this.feeCosts = feeInToken;
    }
    return this.feeCosts;
  }

  async customBridgeTxn(
    owner,
    fromChainId,
    toChainId,
    fromToken,
    toToken,
    amount,
    updateProgress,
  ) {
    // WETH from Arbitrum -> Optimism
    const route = {
      originChainId: fromChainId,
      destinationChainId: toChainId,
      inputToken: fromToken,
      outputToken: toToken,
    };
    const tokenInstance = new ethers.Contract(
      fromToken,
      ERC20,
      PROVIDER(
        CHAIN_ID_TO_CHAIN[fromChainId].name
          .replace(" one", "")
          .replace(" mainnet", ""),
      ),
    );
    const tokenDecimals = await tokenInstance.decimals();
    const quote = await this.sdk.getQuote({
      route,
      inputAmount: amount,
    });
    const bridgeAddress =
      AcrossBridge.spokePoolMapping[
        CHAIN_ID_TO_CHAIN[fromChainId].name.toLowerCase()
      ];
    const spokePoolContract = getContract({
      client: THIRDWEB_CLIENT,
      address: bridgeAddress,
      chain: CHAIN_ID_TO_CHAIN[fromChainId],
      abi: SpokePool,
    });
    const fillDeadlineBuffer = 18000;
    const fillDeadline = Math.round(Date.now() / 1000) + fillDeadlineBuffer;
    const fee = quote.fees.totalRelayFee.total;
    updateProgress(
      `bridge-${fromChainId}-${toChainId}`,
      -Number(ethers.utils.formatUnits(fee, tokenDecimals)),
    );
    const bridgeTxn = prepareContractCall({
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
    return [bridgeTxn, bridgeAddress];
  }
}

export default AcrossBridge;
