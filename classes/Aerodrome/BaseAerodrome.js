import Router from "../../lib/contracts/Aerodrome/Router.json" assert { type: "json" };
import Guage from "../../lib/contracts/Aerodrome/Guage.json" assert { type: "json" };
import Pool from "../../lib/contracts/Aerodrome/Pool.json" assert { type: "json" };
import axios from "axios";
import { ethers } from "ethers";
import { PROVIDER } from "../../utils/general.js";
import axiosRetry from "axios-retry";
import { getContract, prepareContractCall } from "thirdweb";
import THIRDWEB_CLIENT from "../../utils/thirdweb";
import BaseProtocol from "../BaseProtocol.js";
import { approve, CHAIN_ID_TO_CHAIN } from "../../utils/general";
import ERC20_ABI from "../../lib/contracts/ERC20.json" assert { type: "json" };

axiosRetry(axios, { retryDelay: axiosRetry.exponentialDelay });
export class BaseAerodrome extends BaseProtocol {
  static deadline = Math.floor(Date.now() / 1000) + 600; // 10 minute deadline
  constructor(chain, chaindId, symbolList, mode, customParams) {
    super(chain, chaindId, symbolList, mode, customParams);
    this.protocolName = "aerodrome";
    this.protocolVersion = "0";
    this.assetDecimals = this.customParams.assetDecimals;
    this.assetContract = getContract({
      client: THIRDWEB_CLIENT,
      address: this.customParams.assetAddress,
      chain: CHAIN_ID_TO_CHAIN[this.chainId],
      abi: Pool,
    });
    this.protocolContract = getContract({
      client: THIRDWEB_CLIENT,
      address: "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43",
      chain: CHAIN_ID_TO_CHAIN[this.chainId],
      abi: Router,
    });
    this.stakeFarmContract = getContract({
      client: THIRDWEB_CLIENT,
      address: this.customParams.guageAddress,
      chain: CHAIN_ID_TO_CHAIN[this.chainId],
      abi: Guage,
    });

    this.assetContractInstance = new ethers.Contract(
      this.assetContract.address,
      Pool,
      PROVIDER(this.chain),
    );
    this.protocolContractInstance = new ethers.Contract(
      this.protocolContract.address,
      Router,
      PROVIDER(this.chain),
    );
    this.stakeFarmContractInstance = new ethers.Contract(
      this.stakeFarmContract.address,
      Guage,
      PROVIDER(this.chain),
    );
    this._checkIfParamsAreSet();
  }
  zapInSteps(tokenInAddress) {
    return 1;
  }
  zapOutSteps(tokenInAddress) {
    return 1;
  }
  claimAndSwapSteps() {
    return 2;
  }
  rewards() {
    return [
      {
        symbol: "aero",
        coinmarketcapApiId: 29270,
        address: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
        decimals: 18,
      },
    ];
  }
  async pendingRewards(owner, tokenPricesMappingTable, updateProgress) {
    let rewardBalance = {};
    updateProgress(
      `fetching pending rewards from ${this.stakeFarmContract.address}`,
    );
    const stakeFarmContractInstance = new ethers.Contract(
      this.stakeFarmContract.address,
      Guage,
      PROVIDER(this.chain),
    );
    const rewards = this.rewards();
    for (const reward of rewards) {
      const reward_address = reward.address;
      const reward_balance = (
        await stakeFarmContractInstance.functions.earned(owner)
      )[0];
      rewardBalance[reward_address] = {
        symbol: reward.symbol,
        balance: reward_balance,
        usdDenominatedValue:
          (tokenPricesMappingTable[reward.symbol] * reward_balance) /
          Math.pow(10, reward.decimals),
        decimals: reward.decimals,
      };
    }
    return rewardBalance;
  }
  async customDepositLP(
    owner,
    tokenAmetadata,
    tokenBmetadata,
    tokenPricesMappingTable,
    slippage,
    updateProgress,
  ) {
    // Prepare token amounts and approvals
    const tokens = [tokenAmetadata, tokenBmetadata].map(
      ([symbol, address, decimals, amount]) => ({
        address,
        amount,
        minAmount: this.mul_with_slippage_in_bignumber_format(
          amount,
          slippage * 10,
        ),
        decimals,
      }),
    );
    const min_mint_amount = this._calculateMintLP(tokens[0], tokens[1]);

    // Generate approve transactions
    const approveTxns = tokens.map((token) =>
      approve(
        token.address,
        this.protocolContract.address,
        token.amount,
        updateProgress,
        this.chainId,
      ),
    );

    const depositTxn = prepareContractCall({
      contract: this.protocolContract,
      method: "addLiquidity",
      params: [
        tokens[0].address,
        tokens[1].address,
        true,
        tokens[0].amount,
        tokens[1].amount,
        tokens[0].minAmount,
        tokens[1].minAmount,
        owner,
        BaseAerodrome.deadline,
      ],
    });

    // Get staking transactions and combine all transactions
    const stakeTxns = await this._stakeLP(min_mint_amount, updateProgress);
    return [...approveTxns, depositTxn, ...stakeTxns];
  }
  async customClaim(owner, tokenPricesMappingTable, updateProgress) {
    const pendingRewards = await this.pendingRewards(
      owner,
      tokenPricesMappingTable,
      updateProgress,
    );
    const claimTxn = prepareContractCall({
      contract: this.stakeFarmContract,
      method: "getReward",
      params: [owner],
    });
    return [[claimTxn], pendingRewards];
  }
  async usdBalanceOf(owner, tokenPricesMappingTable) {
    const lpBalance = await this.stakeBalanceOf(owner, () => {});
    const lpPrice = await this._calculateLpPrice(tokenPricesMappingTable);
    return lpBalance * lpPrice;
  }
  async assetUsdPrice() {
    return await this._calculateLpPrice(() => {});
  }
  async stakeBalanceOf(owner, updateProgress) {
    const stakeFarmContractInstance = new ethers.Contract(
      this.stakeFarmContract.address,
      ERC20_ABI,
      PROVIDER(this.chain),
    );
    updateProgress("Getting stake balance");
    return (await stakeFarmContractInstance.functions.balanceOf(owner))[0];
  }
  _getLPTokenPairesToZapIn() {
    return this.customParams.lpTokens;
  }
  _calculateTokenAmountsForLP(tokenMetadatas) {
    return [1, 1];
  }
  _calculateMintLP(tokenAmetadata, tokenBmetadata) {
    // Convert amounts to common decimals and calculate average
    const amountA = Number(
      ethers.utils.formatUnits(
        tokenAmetadata.minAmount.toString(),
        tokenAmetadata.decimals,
      ),
    );
    const amountB = Number(
      ethers.utils.formatUnits(
        tokenBmetadata.minAmount.toString(),
        tokenBmetadata.decimals,
      ),
    );

    // Calculate expected LP tokens (average of normalized amounts)
    const averageAmount = ((amountA + amountB) / 2).toFixed(this.assetDecimals);

    // Convert to BigNumber with proper scaling
    return ethers.BigNumber.from(
      String(averageAmount * Math.pow(10, this.assetDecimals)),
    ).div(ethers.BigNumber.from(10).pow(6));
  }
  async _calculateLpPrice(tokenPricesMappingTable) {
    // Get pool metadata and total supply in a single call to reduce RPC requests
    const [lpMetadata, totalSupply] = await Promise.all([
      this.assetContractInstance.functions.metadata(),
      this.assetContractInstance.functions.totalSupply(),
    ]);

    // Destructure reserves
    const [token0Reserve, token1Reserve] = [lpMetadata.r0, lpMetadata.r1];
    const [token0Decimals, token1Decimals] = [
      this.customParams.lpTokens[0][2],
      this.customParams.lpTokens[1][2],
    ];

    // Calculate normalized reserves
    const normalizedReserve0 = Number(
      ethers.utils.formatUnits(token0Reserve, token0Decimals),
    );
    const normalizedReserve1 = Number(
      ethers.utils.formatUnits(token1Reserve, token1Decimals),
    );

    // Calculate total value and return price per LP token
    const totalPoolValue =
      normalizedReserve0 *
        tokenPricesMappingTable[this.customParams.lpTokens[0][0]] +
      normalizedReserve1 *
        tokenPricesMappingTable[this.customParams.lpTokens[1][0]];
    return totalPoolValue / totalSupply;
  }
  async _stakeLP(amount, updateProgress) {
    const approveForStakingTxn = approve(
      this.assetContract.address,
      this.stakeFarmContract.address,
      amount,
      updateProgress,
      this.chainId,
    );
    const stakeTxn = prepareContractCall({
      contract: this.stakeFarmContract,
      method: "function deposit(uint256 _amount)",
      params: [amount],
    });
    return [approveForStakingTxn, stakeTxn];
  }
  async _unstakeLP(owner, percentage, updateProgress) {
    const percentageBN = ethers.BigNumber.from(Math.floor(percentage * 10000));
    const stakeBalance = await this.stakeBalanceOf(owner, updateProgress);
    const amount = stakeBalance.mul(percentageBN).div(10000);
    const unstakeTxn = prepareContractCall({
      contract: this.stakeFarmContract,
      method: "withdraw",
      params: [amount],
    });
    return [[unstakeTxn], amount];
  }
  async _withdrawLPAndClaim(
    owner,
    amount,
    slippage,
    tokenPricesMappingTable,
    updateProgress,
  ) {
    const approveTxn = approve(
      this.assetContract.address,
      this.protocolContract.address,
      amount,
      updateProgress,
      this.chainId,
    );

    updateProgress("Getting LP balances");
    const lpTokens = this._getLPTokenPairesToZapIn();

    // Get pool reserves and calculate withdrawal amounts
    const { minAmount0, minAmount1 } = await this._calculateWithdrawalAmounts(
      amount,
      slippage,
      lpTokens,
    );

    const withdrawTxn = prepareContractCall({
      contract: this.protocolContract,
      method: "removeLiquidity",
      params: [
        lpTokens[0][1], // token0 address
        lpTokens[1][1], // token1 address
        true, // stable
        amount, // LP amount to withdraw
        minAmount0, // min amount token0
        minAmount1, // min amount token1
        owner,
        BaseAerodrome.deadline,
      ],
    });
    const [claimTxns, _] = await this.customClaim(
      owner,
      tokenPricesMappingTable,
      updateProgress,
    );
    return [
      [approveTxn, withdrawTxn, ...claimTxns],
      lpTokens,
      [minAmount0, minAmount1],
    ];
  }

  async _calculateWithdrawalAmounts(lpAmount, slippage, lpTokens) {
    const metadata = await this.assetContractInstance.functions.metadata();
    const [token0Reserve, token1Reserve] = [metadata.r0, metadata.r1];
    const [token0Decimals, token1Decimals] = [lpTokens[0][2], lpTokens[1][2]];

    // Calculate reserves ratio
    const reserve0 = Number(
      ethers.utils.formatUnits(token0Reserve, token0Decimals),
    );
    const reserve1 = Number(
      ethers.utils.formatUnits(token1Reserve, token1Decimals),
    );
    const ratio = reserve0 / (reserve0 + reserve1);

    // Calculate minimum withdrawal amounts with slippage
    const minAmount0 = this._calculateMinWithdrawAmount(
      lpAmount,
      ratio,
      token0Decimals,
      slippage,
    );
    const minAmount1 = this._calculateMinWithdrawAmount(
      lpAmount,
      1 - ratio,
      token1Decimals,
      slippage,
    );
    return { minAmount0, minAmount1 };
  }

  _calculateMinWithdrawAmount(lpAmount, ratio, decimals, slippage) {
    // Convert lpAmount from BigNumber to number, accounting for LP token decimals (18)
    const LP_SCALE = 12;
    const normalizedLpAmount =
      Number(ethers.utils.formatUnits(lpAmount, LP_SCALE)) * 2;
    // Calculate expected withdrawal amount
    const expectedAmount = normalizedLpAmount * ratio;
    // Convert back to BigNumber with proper decimals
    const withdrawAmount = ethers.utils.parseUnits(
      expectedAmount.toFixed(decimals).toString(),
      decimals,
    );
    // Apply slippage and return
    return this.mul_with_slippage_in_bignumber_format(withdrawAmount, slippage);
  }

  async lockUpPeriod() {
    return 0;
  }
}
