import { BigNumber, ethers } from "ethers";
import {
  PrimeSdk,
  DataUtils,
  graphqlEndpoints,
  EtherspotBundler,
} from "@etherspot/prime-sdk";
import * as dotenv from "dotenv";
import { printOp } from "../node_modules/@etherspot/prime-sdk/dist/sdk/common/OperationUtils.js";
import { sleep } from "../node_modules/@etherspot/prime-sdk/dist/sdk/common/index.js";
import { ERC20_ABI } from "../node_modules/@etherspot/prime-sdk/dist/sdk/helpers/abi/ERC20_ABI.js";
import { encodeFunctionData } from "viem";
import permanentPortfolioJson from "../lib/contracts/PermanentPortfolioLPToken.json" assert { type: "json" };
import EntryPointJson from "../lib/contracts/EntryPoint.json" assert { type: "json" };
import CamelotNFTPositionManager from "../lib/contracts/CamelotNFTPositionManager.json" assert { type: "json" };
import { fetch1InchSwapData } from "./oneInch";
// import { PrimeSdk, DataUtils, BatchUserOpsRequest } from '@etherspot/prime-sdk';
import { createWalletClient, custom } from "viem";
import { bsc } from "viem/chains";
import { SmartAccount } from "@particle-network/aa";
// add/change these values
const precisionOfInvestAmount = 4;
// const approvalBufferParam = 1.2;
const approvalBufferParam = 100000000;

//  `Error: execution reverted: STF` means there's no enough tokens to safe transfer from
const slippage = [0.1, 0.5, 1, 10, 50];

// would get `Error: execution reverted: Price slippage check` if it hit the amount0Min and amount1Min when providing liquidity
const slippageOfLP = [0.95, 0.9, 0.8, 0.7, 0.1];

const recipient = "0x3144b7E3a4518541AEB4ceC7fC7A6Dd82f05Ae8B"; // recipient wallet address
const pendleAddress = "0x0c880f6761F1af8d9Aa9C466984b80DAb9a8c9e8";
const oneInchAddress = "0x1111111254EEB25477B68fb85Ed929f73A960582";
const wethAddress = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const linkAddress = "0xf97f4df75117a78c1A5a0DBb814Af92458539FB4";
const axlAddress = "0x23ee2343B892b1BB63503a4FAbc840E0e2C6810f";
const usdcAddress = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const usdtAddress = "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9";
const gmxAddress = "0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a";
const wsolAddress = "0x2bcC6D6CdBbDC0a4071e48bb3B969b06B3330c07";
const rdntAddress = "0x3082CC23568eA640225c2467653dB90e9250AaA0";
const magicAddress = "0x539bdE0d7Dbd336b79148AA742883198BBF60342";
const wstEthAddress = "0x5979D7b546E38E414F7E9822514be443A4800529";
const CamelotNFTPositionManagerAddress =
  "0x00c7f3082833e796A5b3e4Bd59f6642FF44DCD15";

export async function investByAAWallet(
  investmentAmount,
  chosenToken,
  walletClient,
  chain,
) {
  console.log("Investing by AA Wallet...");
  const portfolioHelper = await getPortfolioHelper(
    "AllWeatherPortfolio",
    walletClient,
    chain,
  );
  const transactionHash = await portfolioHelper.diversify(
    investmentAmount,
    chosenToken,
  );
  // console.log("transactionHash", transactionHash);
  // const dataService = new DataUtils(
  //     "public-prime-testnet-key",
  //     graphqlEndpoints.QA,
  // );
  // const balances = await dataService.getAccountBalances({
  //     account: aaWalletAddress,
  //     chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID),
  // });
  // console.log("\x1b[33m%s\x1b[0m", `EtherspotWallet balances:`, balances);
}

async function getPortfolioHelper(portfolioName, walletClient, chain) {
  let portfolioHelper;
  if (portfolioName === "AllWeatherPortfolio") {
    portfolioHelper = new AllWeatherPortfolio(walletClient, chain);
  }
  await portfolioHelper.initialize();
  return portfolioHelper;
}

export class AllWeatherPortfolio {
  constructor(walletClient, chain) {
    // initializating sdk...
    this.AAWallet = new SmartAccount(walletClient, {
      projectId: "b46bf180-cc72-4691-8530-8366006d7468",
      clientKey: "c1S1QbbckW5nwUV9EQFszan25oJCFwfVr7LPTqDd",
      appId: "particle app id",
      aaOptions: {
        accountContracts: {
          SIMPLE: [
            {
              version: "1.0.0",
              chainIds: [chain.id],
            },
          ],
        },
        // paymasterApiKeys: [{
        //     chainId: chain.id,
        //     apiKey: 'paymaster api key',
        // }]
      },
    });

    this.EOAAddress = walletClient.account.address;
    this.txs = {
      long_term_bond: [],
      intermediate_term_bond: [],
      commodities: [],
      gold: [],
      large_cap_us_stocks: [],
      small_cap_us_stocks: [],
      non_us_developed_market_stocks: [],
      non_us_emerging_market_stocks: [],
    };
  }
  async initialize() {
    // get address of EtherspotWallet...
    this.aaWalletAddress = await this.AAWallet.getAddress();
    console.log("aaWalletAddress", this.aaWalletAddress);
    this.strategy = {
      long_term_bond: {
        42161: [
          {
            interface: new CamelotV3(
              42161,
              wstEthAddress,
              wethAddress,
              this.txs,
              this.aaWalletAddress,
            ),
            weight: 0.13,
          },
        ],
      },
      // intermediate_term_bond: {
      //   42161: [
      //     {
      //       interface: new CamelotV3(
      //         42161,
      //         pendleAddress,
      //         wethAddress,
      //         this.txs,
      //         this.aaWalletAddress,
      //       ),
      //       weight: 0.15 * 2,
      //     },
      //   ],
      // },
      // commodities: {},
      // gold: {
      //   42161: [
      //     {
      //       interface: new CamelotV3(
      //         42161,
      //         wethAddress,
      //         gmxAddress,
      //         this.txs,
      //         this.aaWalletAddress,
      //       ),
      //       weight: 0.075 * 2,
      //     },
      //   ],
      // },
      // large_cap_us_stocks: {
      //   42161: [
      //     {
      //       interface: new CamelotV3(
      //         42161,
      //         wethAddress,
      //         linkAddress,
      //         this.txs,
      //         this.aaWalletAddress,
      //       ),
      //       weight: 0.09 * 2,
      //     },
      //   ],
      // },
      // small_cap_us_stocks: {
      //   42161: [
      //     {
      //       interface: new CamelotV3(
      //         42161,
      //         rdntAddress,
      //         wethAddress,
      //         this.txs,
      //         this.aaWalletAddress,
      //       ),
      //       weight: 0.03 * 2,
      //     },
      //   ],
      // },
      // non_us_developed_market_stocks: {
      //   42161: [
      //     {
      //       interface: new CamelotV3(
      //         42161,
      //         wsolAddress,
      //         usdcAddress,
      //         this.txs,
      //         this.aaWalletAddress,
      //       ),
      //       weight: 0.06 * 2,
      //     },
      //   ],
      // },
      // non_us_emerging_market_stocks: {
      //   42161: [
      //     {
      //       interface: new CamelotV3(
      //         42161,
      //         magicAddress,
      //         wethAddress,
      //         this.txs,
      //         this.aaWalletAddress,
      //       ),
      //       weight: 0.03 * 2,
      //     },
      //   ],
      // },
    };
    this._checkTotalWeight(this.strategy);
  }
  _checkTotalWeight(strategyObject) {
    let totalWeight = 0;
    for (const strategyKey in strategyObject) {
      const strategy = strategyObject[strategyKey]; // Access each strategy object
      for (const bondKey in strategy) {
        const bonds = strategy[bondKey]; // Access bond array within each strategy
        for (const bond of bonds) {
          totalWeight += bond.weight; // Access weight property and add to total
        }
      }
    }
    console.log("Total Weight: ", totalWeight);
    // if (Math.abs(totalWeight - 1) > 0.0001) {
    //   throw new Error("Total weight of all protocols must be 1");
    // }
  }
  async diversify(investmentAmount, chosenToken) {
    const transactionHashes = await this._diversify(
      investmentAmount,
      chosenToken,
    );
    return transactionHashes;
  }

  async _diversify(investmentAmount, chosenToken) {
    let transactionHashes = [];
    for (const [category, protocolsInThisCategory] of Object.entries(
      this.strategy,
    )) {
      this._clearTxs(category);
      for (const [chainId, protocols] of Object.entries(
        protocolsInThisCategory,
      )) {
        const transactionHash = await this._retryFunction(
          this._investInThisCategory.bind(this),
          { investmentAmount, chosenToken, protocols, category },
          // { retries: 5, delay: 1000 },
          { retries: 1, delay: 1000 },
        );
        transactionHashes.push(transactionHash);
      }
    }
    return transactionHashes;
  }

  _clearTxs(category) {
    this.txs[category] = [];
  }
  async _investInThisCategory({
    investmentAmount,
    chosenToken,
    protocols,
    category,
    retryIndex,
  }) {
    let concurrentRequests = [];
    for (const protocol of protocols) {
      const investPromise = protocol.interface.invest(
        (investmentAmount * protocol.weight).toFixed(precisionOfInvestAmount),
        chosenToken,
        retryIndex,
        category,
      );
      concurrentRequests.push(investPromise);
    }
    await Promise.all(concurrentRequests);
    return await this._signTransaction(category);
  }

  async _signTransaction(category) {
    // estimate transactions added to the batch and get the fee data for the UserOp
    console.log(`${category} txs`, this.txs);
    const userOpBundle = await this.AAWallet.buildUserOperation({ tx: this.txs })
    console.log("userOpBundle", userOpBundle)
    // const feeQuotesResult = await this.AAWallet.getFeeQuotes(
    //   this.txs[category],
    // );
    // console.log(`Investment in ${category} completed...`, feeQuotesResult);
    // console.log(`Estimate UserOp: ${await printOp(op)}`);
    //   // sign the UserOp and sending to the bundler...
    //   const uoHash = await AAWallet.send(op);
    //   console.log(`UserOpHash: ${uoHash}`);
    //   // get transaction hash...
    //   console.log("Waiting for transaction...");
    //   let userOpsReceipt = null;
    //   const timeout = Date.now() + 60000; // 1 minute timeout
    //   while (userOpsReceipt == null && Date.now() < timeout) {
    //     await sleep(2);
    //     userOpsReceipt = await AAWallet.getUserOpReceipt(uoHash);
    //   }
    // return uoHash;
  }
  async _retryFunction(fn, params, options = {}) {
    const { retries = 3, delay = 1000 } = options; // Set defaults

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        params.retryIndex = attempt - 1;
        const result = await fn(params);
        return result; // Exit on successful execution
      } catch (error) {
        console.error(
          `Attempt ${params.category} ${attempt}/${retries}: Error occurred, retrying...`,
          error,
        );
        await new Promise((resolve) => setTimeout(resolve, delay)); // Wait before retry
      }
    }
    throw new Error(`Function failed after ${retries} retries`); // Throw error if all retries fail
  }
}

class CamelotV3 {
  constructor(chaindId, token0, token1, txs, aaWalletAddress) {
    this.chainId = chaindId;
    this.token0 = token0;
    this.token1 = token1;
    this.txs = txs;
    this.provider = new ethers.providers.JsonRpcProvider(
      process.env.NEXT_PUBLIC_BUNDLER_URL,
    );
    this.aaWalletAddress = aaWalletAddress;
  }

  async invest(
    investmentAmountInThisPosition,
    chosenToken,
    retryIndex,
    category,
  ) {
    // get erc20 Contract Interface
    const erc20Instance = new ethers.Contract(
      chosenToken,
      ERC20_ABI,
      this.provider,
    );

    // get decimals from erc20 contract
    const decimals = (await erc20Instance.functions.decimals())[0];
    console.log("!!!!!!!!!!!!!!!")
    console.log("!!!!!!!!!!!!!!!")
    console.log("!!!!!!!!!!!!!!!")
    this.txs[category].push({
      to: usdtAddress,
      data: encodeFunctionData({
        abi: permanentPortfolioJson.abi,
        functionName: "approve",
        args: [
          oneInchAddress,
          ethers.utils.parseUnits(
            // String(
            //   (investmentAmountInThisPosition * approvalBufferParam).toFixed(
            //     decimals,
            //   ),
            // ),
            // decimals,
            "10000000",
            6,
          ),
        ],
      }),
    });
    // const swapCallDataFrom1inch = await fetch1InchSwapData(
    //   42161,
    //   usdtAddress,
    //   pendleAddress,
    //   ethers.utils.parseUnits("1", 6),
    //   this.aaWalletAddress,
    //   50,
    // );
    // this.txs[category].push({
    //   to: oneInchAddress,
    //   data: swapCallDataFrom1inch["tx"]["data"],
    // });

    // const [token0Amount, token1Amount] = await this._concurrentSwap(
    //   chosenToken,
    //   investmentAmountInThisPosition,
    //   decimals,
    //   retryIndex,
    //   category
    // );
    // await this._concurrentApprove(token0Amount, token1Amount, category);
    // await this._deposit(token0Amount, token1Amount, retryIndex, category);
  }

  async _concurrentSwap(
    chosenToken,
    investmentAmountInThisPosition,
    decimals,
    retryIndex,
    category,
  ) {
    // let tokenSwapPromises = [];
    // for (const token of [this.token0, this.token1]) {
    // tokenSwapPromises.push(
    console.log(
      ethers.utils.parseUnits(
        String(investmentAmountInThisPosition / 2),
        decimals,
      ),
      "Amount",
    );
    await this._swap(
      usdtAddress,
      pendleAddress,
      ethers.utils.parseUnits(
        String(investmentAmountInThisPosition / 2),
        decimals,
      ),
      // ethers.utils.parseUnits(String(0.0001), 6),
      50,
      // slippage[retryIndex],
      category,
    );
    // );
    // }
    return [1, 2];
    // const [token0Amount, token1Amount] = await Promise.all(tokenSwapPromises);
    return [token0Amount, token1Amount];
  }

  async _concurrentApprove(token0Amount, token1Amount, category) {
    let tokenApprovePromises = [];
    for (const [token, tokenAmount] of [
      [this.token0, token0Amount],
      [this.token1, token1Amount],
    ]) {
      tokenApprovePromises.push(
        this._approve(
          token,
          CamelotNFTPositionManagerAddress,
          tokenAmount,
          category,
        ),
      );
    }
    await Promise.all(tokenApprovePromises);
  }
  async withdraw() {
    throw new Error("This function is not implemented yet.");
  }
  async rebalance() {
    throw new Error("This function is not implemented yet.");
  }
  async _swap(fromTokenAddress, toTokenAddress, amount, slippage, category) {
    console.log("chain id", this.chainId, this.aaWalletAddress);
    const swapCallDataFrom1inch = await fetch1InchSwapData(
      this.chainId,
      fromTokenAddress,
      toTokenAddress,
      amount,
      this.aaWalletAddress,
      slippage,
    );
    await this.txs[category].push({
      to: oneInchAddress,
      data: swapCallDataFrom1inch["tx"]["data"],
    });
    return swapCallDataFrom1inch["toAmount"];
  }
  async _approve(tokenAddress, spenderAddress, amount, category) {
    await this.txs[category].push({
      to: tokenAddress,
      data: encodeFunctionData({
        abi: permanentPortfolioJson.abi,
        functionName: "approve",
        args: [
          spenderAddress,
          ethers.BigNumber.from(amount).mul(approvalBufferParam),
        ],
      }),
    });
  }
  async _deposit(token0Amount, token1Amount, retryIndex, category) {
    const camelotCallData = encodeFunctionData({
      abi: CamelotNFTPositionManager,
      functionName: "mint",
      args: [
        {
          token0: this.token0,
          token1: this.token1,
          tickLower: -887220,
          tickUpper: 887220,
          amount0Desired: token0Amount,
          amount1Desired: token1Amount,
          amount0Min: Math.floor(token0Amount * slippageOfLP[retryIndex]),
          amount1Min: Math.floor(token1Amount * slippageOfLP[retryIndex]),
          recipient: this.aaWalletAddress,
          deadline: Math.floor(Date.now() / 1000) + 600,
          // deadline: Date.now()+100000000
        },
      ],
    });
    await this.txs[category].push({
      to: CamelotNFTPositionManagerAddress,
      data: camelotCallData,
    });
  }
}
