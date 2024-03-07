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
import { Web3WalletProvider } from "@etherspot/prime-sdk";

// add/change these values
const precisionOfInvestAmount = 4;
// const approvalBufferParam = 1.2;
const approvalBufferParam = 100;

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
) {
  console.log("Investing by AA Wallet...");
  console.log("chosenToken", chosenToken);
  const mappedProvider = new Web3WalletProvider(walletClient);
  // await mappedProvider.refresh();
  console.log("mappedProvider", mappedProvider);

  const portfolioHelper = await getPortfolioHelper(
    "AllWeatherPortfolio",
    mappedProvider,
  );
  const transactionHash = await portfolioHelper.diversify(
    investmentAmount,
    chosenToken,
  );
  console.log("transactionHash", transactionHash);
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

async function getPortfolioHelper(portfolioName, mappedProvider) {
  let portfolioHelper;
  if (portfolioName === "AllWeatherPortfolio") {
    portfolioHelper = new AllWeatherPortfolio(mappedProvider);
  }
  await portfolioHelper.initialize();
  return portfolioHelper;
}

export class AllWeatherPortfolio {
  constructor(mappedProvider) {
    // initializating sdk...
    const customBundlerUrl = "";
    this.primeSdk = new PrimeSdk(
      mappedProvider,
      // { privateKey: process.env.NEXT_PUBLIC_WALLET_PRIVATE_KEY },
      {
        chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID),
        projectKey: "all-weather-dev",
        bundlerProvider: new EtherspotBundler(
          Number(process.env.NEXT_PUBLIC_CHAIN_ID),
          process.env.NEXT_PUBLIC_ETHERSPOT_PROJECT_KEY,
          customBundlerUrl,
        ),
      },
    ); // Testnets dont need apiKey on bundlerProvider
    this.EOAAddress = this.primeSdk.state.EOAAddress;
  }
  async initialize() {
    // get address of EtherspotWallet...
    this.aaWalletAddress = await this.primeSdk.getCounterFactualAddress();
    console.log("aaWalletAddress", this.aaWalletAddress);
    this.strategy = {
      long_term_bond: {
        42161: [
          {
            interface: new CamelotV3(
              42161,
              wstEthAddress,
              wethAddress,
              this.primeSdk,
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
      //         this.primeSdk,
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
      //         this.primeSdk,
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
      //         this.primeSdk,
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
      //         this.primeSdk,
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
      //         this.primeSdk,
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
      //         this.primeSdk,
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
    if (Math.abs(totalWeight - 1) > 0.0001) {
      throw new Error("Total weight of all protocols must be 1");
    }
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
      for (const [chainId, protocols] of Object.entries(
        protocolsInThisCategory,
      )) {
        const transactionHash = await this._retryFunction(
          this._investInThisCategory.bind(this),
          { investmentAmount, chosenToken, protocols, category },
          { retries: 5, delay: 1000 },
        );
        transactionHashes.push(transactionHash);
      }
    }
    return transactionHashes;
  }
  async _investInThisCategory({
    investmentAmount,
    chosenToken,
    protocols,
    category,
    retryIndex,
  }) {
    // clear the transaction batch
    await this.primeSdk.clearUserOpsFromBatch();
    let concurrentRequests = [];
    for (const protocol of protocols) {
      const investPromise = protocol.interface.invest(
        (investmentAmount * protocol.weight).toFixed(precisionOfInvestAmount),
        chosenToken,
        retryIndex,
      );
      concurrentRequests.push(investPromise);
    }
    await Promise.all(concurrentRequests);
    return await this._signTransaction(category);
  }

  async _signTransaction(category) {
    // estimate transactions added to the batch and get the fee data for the UserOp
    const op = await this.primeSdk.estimate();
    console.log(`Investment in ${category} completed...`);
    // console.log(`Estimate UserOp: ${await printOp(op)}`);
    //   // sign the UserOp and sending to the bundler...
    //   const uoHash = await primeSdk.send(op);
    //   console.log(`UserOpHash: ${uoHash}`);
    //   // get transaction hash...
    //   console.log("Waiting for transaction...");
    //   let userOpsReceipt = null;
    //   const timeout = Date.now() + 60000; // 1 minute timeout
    //   while (userOpsReceipt == null && Date.now() < timeout) {
    //     await sleep(2);
    //     userOpsReceipt = await primeSdk.getUserOpReceipt(uoHash);
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
  constructor(chaindId, token0, token1, primeSdk, aaWalletAddress) {
    this.chainId = chaindId;
    this.token0 = token0;
    this.token1 = token1;
    this.primeSdk = primeSdk;
    this.provider = new ethers.providers.JsonRpcProvider(
      process.env.NEXT_PUBLIC_BUNDLER_URL,
    );
    this.aaWalletAddress = aaWalletAddress;
  }

  async invest(investmentAmountInThisPosition, chosenToken, retryIndex) {
    // get erc20 Contract Interface
    const erc20Instance = new ethers.Contract(
      chosenToken,
      ERC20_ABI,
      this.provider,
    );

    // get decimals from erc20 contract
    const decimals = (await erc20Instance.functions.decimals())[0];
    await this.primeSdk.addUserOpsToBatch({
      to: chosenToken,
      data: encodeFunctionData({
        abi: permanentPortfolioJson.abi,
        functionName: "approve",
        args: [
          oneInchAddress,
          ethers.utils.parseUnits(
            String(
              (investmentAmountInThisPosition * approvalBufferParam).toFixed(
                decimals,
              ),
            ),
            decimals,
            // 6
          ),
        ],
      }),
    });
    const [token0Amount, token1Amount] = await this._concurrentSwap(
      chosenToken,
      investmentAmountInThisPosition,
      decimals,
      retryIndex,
    );
    await this._concurrentApprove(token0Amount, token1Amount);
    await this._deposit(token0Amount, token1Amount, retryIndex);
  }

  async _concurrentSwap(
    chosenToken,
    investmentAmountInThisPosition,
    decimals,
    retryIndex,
  ) {
    let tokenSwapPromises = [];
    for (const token of [this.token0, this.token1]) {
      tokenSwapPromises.push(
        this._swap(
          chosenToken,
          token,
          ethers.utils.parseUnits(
            String(investmentAmountInThisPosition / 2),
            decimals,
          ),
          slippage[retryIndex],
        ),
      );
    }
    const [token0Amount, token1Amount] = await Promise.all(tokenSwapPromises);
    return [token0Amount, token1Amount];
  }

  async _concurrentApprove(token0Amount, token1Amount) {
    let tokenApprovePromises = [];
    for (const [token, tokenAmount] of [
      [this.token0, token0Amount],
      [this.token1, token1Amount],
    ]) {
      tokenApprovePromises.push(
        this._approve(token, CamelotNFTPositionManagerAddress, tokenAmount),
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
  async _swap(fromTokenAddress, toTokenAddress, amount, slippage) {
    const swapCallDataFrom1inch = await fetch1InchSwapData(
      this.chainId,
      fromTokenAddress,
      toTokenAddress,
      amount,
      this.aaWalletAddress,
      slippage,
    );
    await this.primeSdk.addUserOpsToBatch({
      to: oneInchAddress,
      data: swapCallDataFrom1inch["tx"]["data"],
    });
    return swapCallDataFrom1inch["toAmount"];
  }
  async _approve(tokenAddress, spenderAddress, amount) {
    await this.primeSdk.addUserOpsToBatch({
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
  async _deposit(token0Amount, token1Amount, retryIndex) {
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
    await this.primeSdk.addUserOpsToBatch({
      to: CamelotNFTPositionManagerAddress,
      data: camelotCallData,
    });
  }
}
