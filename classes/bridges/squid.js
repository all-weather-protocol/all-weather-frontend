import BaseBridge from "./BaseBridge";
import { Squid } from "@0xsquid/sdk";
import { CHAIN_ID_TO_CHAIN } from "../../utils/general";
import THIRDWEB_CLIENT from "../../utils/thirdweb";

class SquidBridge extends BaseBridge {
  constructor() {
    super("squid");
    this.sdk = new Squid({
      baseUrl: "https://v2.api.squidrouter.com/",
      integratorId: process.env.NEXT_PUBLIC_INTEGRATOR_ID,
    });
    this.squidRouterContract = "0xce16F69375520ab01377ce7B88f5BA8C48F8D666";
    this.lastRequestTime = 0;
    this.minRequestInterval = 3000;
    this.isInitialized = false;
    this.feeCosts = null;
  }

  async delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async throttleRequest() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.minRequestInterval) {
      await this.delay(this.minRequestInterval - timeSinceLastRequest);
    }
    this.lastRequestTime = Date.now();
  }

  async init() {
    if (!this.isInitialized) {
      await this.sdk.init();
      this.isInitialized = true;
    }
  }

  async getFeeCosts(
    account,
    fromChainId,
    toChainId,
    inputToken,
    targetToken,
    inputAmount,
    isInit = false,
  ) {
    const maxRetries = 3;
    let retryCount = 0;
    while (retryCount < maxRetries) {
      try {
        await this.throttleRequest();
        const { route } = await this.sdk.getRoute({
          fromAddress: account,
          fromChain: fromChainId.toString(),
          fromToken: inputToken,
          fromAmount: inputAmount.toString(),
          toChain: toChainId.toString(),
          toToken: targetToken,
          toAddress: account,
          enableBoost: isInit,
          quoteOnly: isInit,
        });
        this.feeCosts = route.estimate?.feeCosts?.[0]?.amountUsd;
        return this.feeCosts;
      } catch (error) {
        console.error(`Attempt ${retryCount + 1} failed:`, error);
        retryCount++;

        if (error.response?.status === 429 && retryCount < maxRetries) {
          const waitTime = Math.pow(2, retryCount) * 1000;
          console.log(
            `Rate limited, waiting ${
              waitTime / 1000
            }s before retry ${retryCount}/${maxRetries}`,
          );
          await this.delay(waitTime);
          continue;
        }
        throw error;
      }
    }
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
    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        await this.throttleRequest();
        const { route } = await this.sdk.getRoute({
          fromAddress: owner,
          fromChain: fromChainId.toString(),
          fromToken: fromToken,
          fromAmount: amount.toString(),
          toChain: toChainId.toString(),
          toToken: toToken,
          toAddress: owner,
          slippage: 1,
          enableForecall: false,
          quoteOnly: false,
        });

        if (route.estimate?.feeCosts?.length > 0) {
          const fee = route.estimate?.feeCosts?.[0]?.amountUsd;
          updateProgress(`bridge-${fromChainId}-${toChainId}`, -Number(fee));
        }

        const bridgeTxn = {
          client: THIRDWEB_CLIENT,
          to: route.transactionRequest.target,
          chain: CHAIN_ID_TO_CHAIN[fromChainId],
          data: route.transactionRequest.data,
          value: route.transactionRequest.value,
          gasLimit: route.transactionRequest.gasLimit,
          maxFeePerGas: route.transactionRequest.maxFeePerGas,
          maxPriorityFeePerGas: route.transactionRequest.maxPriorityFeePerGas,
        };

        const routeTargetContract = route.transactionRequest.target;

        return [bridgeTxn, routeTargetContract];
      } catch (error) {
        console.error(`Attempt ${retryCount + 1} failed:`, error);
        retryCount++;

        if (retryCount < maxRetries) {
          const waitTime = 3000;
          console.log(`Retrying in ${waitTime / 1000} seconds...`);
          await this.delay(waitTime);
          continue;
        }
        throw error;
      }
    }
  }
}

export default SquidBridge;
