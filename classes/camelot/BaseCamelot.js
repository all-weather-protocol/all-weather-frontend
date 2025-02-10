import { ethers } from "ethers";
import { ERC20_ABI } from "@etherspot/prime-sdk/dist/sdk/helpers/abi/ERC20_ABI.js";
import CamelotNFTPositionManager from "../../lib/contracts/CamelotNFTPositionManager.json" assert { type: "json" };
import {
  approve,
  CHAIN_ID_TO_CHAIN,
  PROVIDER,
  CHAIN_TO_CHAIN_ID,
} from "../../utils/general.js";
import { getContract, prepareContractCall } from "thirdweb";
import THIRDWEB_CLIENT from "../../utils/thirdweb.js";
import BaseProtocol from "../BaseProtocol.js";
import AlgebraPool from "../../lib/contracts/Camelot/AlgebraPool.json" assert { type: "json" };
import axios from "axios";
import Distributor from "../../lib/contracts/Camelot/Distributor.json" assert { type: "json" };
import XGrailToken from "../../lib/contracts/Camelot/XGrailToken.json" assert { type: "json" };
export class BaseCamelot extends BaseProtocol {
  constructor(chain, chainId, symbolList, mode, customParams) {
    super(chain, chainId, symbolList, mode, customParams);
    this.protocolName = "camelot";
    this.protocolVersion = "v3";
    this.assetDecimals = 18;
    this.token_id;

    this.assetContract = getContract({
      client: THIRDWEB_CLIENT,
      address: this.customParams.assetAddress,
      chain: CHAIN_ID_TO_CHAIN[this.chainId],
      abi: CamelotNFTPositionManager,
    });
    this.protocolContract = getContract({
      client: THIRDWEB_CLIENT,
      address: this.customParams.protocolAddress,
      chain: CHAIN_ID_TO_CHAIN[this.chainId],
      abi: AlgebraPool,
    });
    this.stakeFarmContract = getContract({
      client: THIRDWEB_CLIENT,
      address: this.customParams.protocolAddress,
      chain: CHAIN_ID_TO_CHAIN[this.chainId],
      abi: ERC20_ABI,
    });
    this.rewardContract = getContract({
      client: THIRDWEB_CLIENT,
      address: this.customParams.rewardPoolAddress,
      chain: CHAIN_ID_TO_CHAIN[this.chainId],
      abi: Distributor,
    });
    this.grailContract = getContract({
      client: THIRDWEB_CLIENT,
      address: "0x3d9907F9a368ad0a51Be60f7Da3b97cf940982D8",
      chain: CHAIN_ID_TO_CHAIN[this.chainId],
      abi: ERC20_ABI,
    });
    this.xgrailContract = getContract({
      client: THIRDWEB_CLIENT,
      address: "0x3caae25ee616f2c8e13c74da0813402eae3f496b",
      chain: CHAIN_ID_TO_CHAIN[this.chainId],
      abi: XGrailToken,
    });

    this.assetContractInstance = new ethers.Contract(
      this.assetContract.address,
      CamelotNFTPositionManager,
      PROVIDER(this.chain),
    );
    this.protocolContractInstance = new ethers.Contract(
      this.protocolContract.address,
      AlgebraPool,
      PROVIDER(this.chain),
    );
    this.stakeFarmContractInstance = new ethers.Contract(
      this.stakeFarmContract.address,
      ERC20_ABI,
      PROVIDER(this.chain),
    );
    this.xgrailContractInstance = new ethers.Contract(
      this.xgrailContract.address,
      XGrailToken,
      PROVIDER(this.chain),
    );

    this._checkIfParamsAreSet();
  }
  rewards() {
    return [
      {
        symbol: "grail",
        priceId: {
          coinmarketcapApiId: 22949,
        },
        address: "0x3d9907F9a368ad0a51Be60f7Da3b97cf940982D8",
        decimals: 18,
      },
    ];
  }
  async assetBalanceOf(recipient) {
    if (!this.token_id) {
      this.token_id = await this._getNftID(recipient);
    }
    if (!this.token_id) {
      return undefined;
    }
    try {
      const position = await this.assetContractInstance.functions.positions(
        this.token_id,
      );
      return position.liquidity;
    } catch (error) {
      // it means the NFT has been burned
      return undefined;
    }
  }
  async usdBalanceOf(owner, tokenPricesMappingTable) {
    if (!this.token_id) {
      this.token_id = await this._getNftID(owner);
    }
    if (!this.token_id) {
      return 0;
    }
    return await this.getNFTValue(
      this.token_id,
      this.protocolContractInstance,
      this.assetContractInstance,
      tokenPricesMappingTable,
      this.customParams.lpTokens[0][0],
      this.customParams.lpTokens[1][0],
      this.customParams.lpTokens[0][2],
      this.customParams.lpTokens[1][2],
    );
  }
  async assetUsdPrice(tokenPricesMappingTable) {
    return 0;
  }

  async stakeBalanceOf(owner) {
    // Get NFT positions balance
    return ethers.BigNumber.from(0);
  }
  rewards() {
    return this.customParams.rewards;
  }

  async pendingRewards(owner, tokenPricesMappingTable, updateProgress) {
    if (!this.token_id) {
      this.token_id = await this._getNftID(owner);
    }
    if (!this.token_id || !(await this._checkIfNFTExists(this.token_id))) {
      return {};
    }

    const [lpFeesRewards, marketMakerRewards, vestingRewards] =
      await Promise.all([
        this._getLPFeesRewards(tokenPricesMappingTable),
        this._getMarketMakerRewards(owner, tokenPricesMappingTable),
        this._checkIfVestingRewardsFinished(owner, tokenPricesMappingTable),
      ]);

    return this._mergeRewards(
      lpFeesRewards,
      marketMakerRewards,
      vestingRewards,
    );
  }

  async _getLPFeesRewards(tokenPricesMappingTable) {
    const [
      [token0, token0Address, token0Decimals],
      [token1, token1Address, token1Decimals],
    ] = this.customParams.lpTokens;

    const { fees0, fees1 } = await this.getUncollectedFeesForCamelot(
      this.token_id,
      this.assetContractInstance,
      this.protocolContractInstance,
    );

    return {
      [token0Address]: {
        symbol: token0,
        balance: ethers.BigNumber.from(String(Math.floor(fees0))),
        usdDenominatedValue:
          tokenPricesMappingTable[token0] * (fees0 / 10 ** token0Decimals),
        decimals: token0Decimals,
      },
      [token1Address]: {
        symbol: token1,
        balance: ethers.BigNumber.from(String(Math.floor(fees1))),
        usdDenominatedValue:
          tokenPricesMappingTable[token1] * (fees1 / 10 ** token1Decimals),
        decimals: token1Decimals,
        vesting: false,
      },
    };
  }

  _mergeRewards(rewardBalance, marketMakerRewards, vestingRewards) {
    // Merge all rewards sources into a single array of [address, reward] entries
    const allRewards = [
      ...Object.entries(rewardBalance),
      ...Object.entries(marketMakerRewards),
      ...Object.entries(vestingRewards),
    ];

    return allRewards.reduce((acc, [address, reward]) => {
      if (acc[address]) {
        // Preserve all existing fields and only update balance and usdDenominatedValue
        acc[address] = {
          ...acc[address],
          ...reward,
          balance: acc[address].balance.add(reward.balance),
          usdDenominatedValue:
            acc[address].usdDenominatedValue + reward.usdDenominatedValue,
        };
      } else {
        acc[address] = reward;
      }
      return acc;
    }, {});
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
        decimals,
        symbol,
      }),
    );
    await this._updateProgressAndWait(
      updateProgress,
      `${this.uniqueId()}-deposit`,
      0,
    );
    await this._updateProgressAndWait(
      updateProgress,
      `${this.uniqueId()}-stake`,
      0,
    );
    // Generate approve transactions
    const approveTxns = tokens.map((token) =>
      approve(
        token.address,
        this.assetContract.address,
        token.amount,
        updateProgress,
        this.chainId,
      ),
    );
    let depositTxn;
    if (!this.token_id) {
      this.token_id = await this._getNftID(owner);
    }
    if (this.token_id) {
      depositTxn = this._increateLiquidityToExistingNFT(
        this.token_id,
        tokens[0].amount,
        tokens[1].amount,
        slippage,
      );
    } else {
      depositTxn = this._mintLpNFT(
        owner,
        tokens[0].amount,
        tokens[1].amount,
        slippage,
      );
    }
    return [approveTxns, depositTxn];
  }
  async _calculateTokenAmountsForLP(
    usdAmount,
    tokenMetadatas,
    tickers,
    tokenPricesMappingTable,
  ) {
    const { tickLower, tickUpper } = tickers;
    const token0 = tokenMetadatas[0][0];
    const token1 = tokenMetadatas[1][0];
    const token0Decimals = tokenMetadatas[0][2];
    const token1Decimals = tokenMetadatas[1][2];
    const minPrice =
      1.0001 ** tickLower * 10 ** (18 * 2 - token0Decimals - token1Decimals);
    const maxPrice =
      1.0001 ** tickUpper * 10 ** (18 * 2 - token0Decimals - token1Decimals);
    const ratio = this.calculateUniswapV3LP(
      usdAmount,
      tokenPricesMappingTable[tokenMetadatas[0][0]],
      tokenPricesMappingTable[tokenMetadatas[1][0]],
      tokenPricesMappingTable[tokenMetadatas[0][0]] /
        tokenPricesMappingTable[tokenMetadatas[1][0]],
      minPrice,
      maxPrice,
      tokenPricesMappingTable[token0],
      tokenPricesMappingTable[token1],
      token0Decimals,
      token1Decimals,
    );
    return ratio;
  }
  async customClaim(owner, tokenPricesMappingTable, updateProgress) {
    // Get pending rewards first
    const pendingRewards = await this.pendingRewards(
      owner,
      tokenPricesMappingTable,
      updateProgress,
    );

    // Get vesting rewards transactions
    const vestingRewardsTxns = await this.customRedeemVestingRewards(
      pendingRewards,
      owner,
    );

    // If no NFT exists, only return vesting rewards
    if (this.token_id === 0) {
      return [vestingRewardsTxns, pendingRewards];
    }

    // Prepare transaction to collect LP fees
    const lpFeesTxn = prepareContractCall({
      contract: this.assetContract,
      method: "collect",
      params: [
        {
          tokenId: this.token_id,
          recipient: owner,
          amount0Max: ethers.BigNumber.from(
            "340282366920938463463374607431768211455",
          ), // 2^128 - 1
          amount1Max: ethers.BigNumber.from(
            "340282366920938463463374607431768211455",
          ), // 2^128 - 1
        },
      ],
    });

    // Return combined transactions and rewards
    return [[lpFeesTxn, ...vestingRewardsTxns], pendingRewards];
  }

  async lockUpPeriod() {
    return 0;
  }
  async _stakeLP(amount, updateProgress) {
    await super._stakeLP(amount, updateProgress);
    return [];
  }
  async _unstakeLP(owner, percentage, updateProgress) {
    await super._unstakeLP(owner, percentage, updateProgress);
    const percentageBN = ethers.BigNumber.from(
      String(Math.floor(percentage * 10000)),
    );
    const assetBalance = await this.assetBalanceOf(owner);
    if (assetBalance === undefined) {
      return [[], undefined];
    }
    const amount = assetBalance.mul(percentageBN).div(10000);
    return [[], amount];
  }
  async _withdrawLPAndClaim(
    owner,
    amount,
    slippage,
    tokenPricesMappingTable,
    updateProgress,
  ) {
    await super._withdrawLPAndClaim(
      owner,
      amount,
      slippage,
      tokenPricesMappingTable,
      updateProgress,
    );
    if (!this.token_id) {
      this.token_id = await this._getNftID(owner);
    }
    const { amount0, amount1 } = await this.getWithdrawalAmounts(
      this.token_id,
      this.assetContractInstance,
      this.protocolContractInstance,
      amount,
    );
    const amount0Min = this.mul_with_slippage_in_bignumber_format(
      amount0,
      slippage,
    );
    const amount1Min = this.mul_with_slippage_in_bignumber_format(
      amount1,
      slippage,
    );
    await this._updateProgressAndWait(
      updateProgress,
      `${this.uniqueId()}-withdraw`,
      0,
    );

    const [claimTxns] = await this.customClaim(
      owner,
      tokenPricesMappingTable,
      updateProgress,
    );
    const burnTxn = this._prepareBurnTransaction();
    if (amount.toString() === "0") {
      return [
        [...claimTxns, burnTxn],
        this.customParams.lpTokens,
        [amount0, amount1],
      ];
    }

    const liquidity = await this.assetBalanceOf(owner);
    const withdrawTxn = this._prepareWithdrawTransaction(
      amount,
      amount0Min,
      amount1Min,
    );
    const transactions = amount.eq(liquidity)
      ? [withdrawTxn, ...claimTxns, burnTxn]
      : [withdrawTxn, ...claimTxns];

    return [transactions, this.customParams.lpTokens, [amount0, amount1]];
  }

  _prepareBurnTransaction() {
    return prepareContractCall({
      contract: this.assetContract,
      method: "burn",
      params: [this.token_id],
    });
  }

  _prepareWithdrawTransaction(amount, amount0Min, amount1Min) {
    // 0x08c379a000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000014507269636520736c69707061676520636865636b000000000000000000000000
    // means the return amount is less than amount0Min and amount1Min
    return prepareContractCall({
      contract: this.assetContract,
      method: "decreaseLiquidity",
      params: [
        {
          tokenId: this.token_id,
          liquidity: amount,
          // amount0Min: 0,
          // amount1Min: 0,
          amount0Min,
          amount1Min,
          deadline: this.getDeadline(),
        },
      ],
    });
  }

  _increateLiquidityToExistingNFT(
    tokenId,
    token0Amount,
    token1Amount,
    slippage,
  ) {
    return prepareContractCall({
      contract: this.assetContract,
      method: "increaseLiquidity",
      params: [
        {
          tokenId,
          amount0Desired: token0Amount,
          amount1Desired: token1Amount,
          amount0Min: 1,
          amount1Min: 1,
          deadline: Math.floor(Date.now() / 1000) + 600,
        },
      ],
    });
  }
  _mintLpNFT(owner, token0Amount, token1Amount, slippage) {
    return prepareContractCall({
      contract: this.assetContract,
      method: "mint",
      params: [
        {
          token0: this.customParams.lpTokens[0][1],
          token1: this.customParams.lpTokens[1][1],
          tickLower: this.customParams.tickers.tickLower,
          tickUpper: this.customParams.tickers.tickUpper,
          amount0Desired: token0Amount,
          amount1Desired: token1Amount,
          amount0Min: 1,
          amount1Min: 1,
          recipient: owner,
          deadline: Math.floor(Date.now() / 1000) + 600,
        },
      ],
    });
  }

  async _getNftID(address) {
    const { tickLower, tickUpper } = this.customParams.tickers;
    const uniqueKey = `${this.assetContract.address.toLowerCase()}/${this.customParams.lpTokens[0][1].toLowerCase()}/${this.customParams.lpTokens[1][1].toLowerCase()}/${tickLower}/${tickUpper}`;
    const chainString = Object.entries(CHAIN_TO_CHAIN_ID).find(
      ([key, value]) => value === this.chainId,
    )[0];
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/${address}/nft/tvl_highest?token_addresses=${this.assetContract.address}&chain=${chainString}`,
    );
    const data = await response.json();
    // Filter entries by uniqueKey before sorting

    const filteredData = Object.entries(data).filter(
      ([key]) => key === uniqueKey,
    );
    const sortedData = filteredData.sort(
      (a, b) => b[1].liquidity - a[1].liquidity,
    );
    if (sortedData.length < 1) {
      return 0;
    }
    return sortedData[0][1]?.token_id ?? 0;
  }
  async _checkIfNFTExists(token_id) {
    try {
      await this.assetContractInstance.positions(token_id);
      return true;
    } catch (error) {
      return false;
    }
  }
  async _getMarketMakerRewards(owner, tokenPricesMappingTable) {
    const response = await axios.get(
      `https://api.camelot.exchange/campaigns/rewards?chainId=${this.chainId}&user=${owner}`,
    );
    const data = response.data;
    const marketMakerRewards = {};

    // Get rewards info from this.rewards()
    const rewardsInfo = this.rewards().reduce((acc, reward) => {
      acc[reward.address.toLowerCase()] = reward;
      return acc;
    }, {});

    for (const reward of data.data.rewards) {
      const rewardAddress = reward.tokenAddress.toLowerCase();
      const rewardInfo = rewardsInfo[rewardAddress];

      if (rewardInfo) {
        const balance = ethers.BigNumber.from(
          String(Math.floor(Number(reward.rewards) - Number(reward.claimed))),
        );

        const newBalance = marketMakerRewards[rewardAddress]
          ? marketMakerRewards[rewardAddress].balance.add(balance)
          : balance;

        marketMakerRewards[rewardAddress] = {
          symbol: rewardInfo.symbol,
          balance: newBalance,
          usdDenominatedValue:
            tokenPricesMappingTable[rewardInfo.symbol] *
            (newBalance.toString() / 10 ** rewardInfo.decimals),
          decimals: rewardInfo.decimals,
          vesting: true,
        };
      }
    }
    return marketMakerRewards;
  }
  async _checkIfVestingRewardsFinished(owner, tokenPricesMappingTable) {
    const finalizableRewards = {
      [this.grailContract.address]: {
        symbol: "grail",
        balance: ethers.BigNumber.from(0),
        usdDenominatedValue: 0,
        decimals: 18,
        vesting: false,
        finalizableIndexes: [],
      },
      [this.xgrailContract.address]: {
        symbol: "xgrail",
        balance: ethers.BigNumber.from(0),
        usdDenominatedValue: 0,
        decimals: 18,
        vesting: true,
      },
    };

    const userRedeemsLength =
      await this.xgrailContractInstance.functions.getUserRedeemsLength(owner);
    for (let i = 0; i < userRedeemsLength; i++) {
      const userRedeem = await this.xgrailContractInstance.functions.userRedeem(
        owner,
        i,
      );
      if (userRedeem.endTime < Math.floor(Date.now() / 1000)) {
        // Vesting period ended - count as grail and track index
        finalizableRewards[this.grailContract.address].balance =
          finalizableRewards[this.grailContract.address].balance.add(
            userRedeem.xgrailAmount,
          );
        finalizableRewards[this.grailContract.address].finalizableIndexes.push(
          i,
        );
      } else {
        // Still vesting - count as xgrail
        finalizableRewards[this.xgrailContract.address].balance =
          finalizableRewards[this.xgrailContract.address].balance.add(
            userRedeem.xgrailAmount,
          );
      }
    }

    // Calculate USD values for both tokens
    finalizableRewards[this.grailContract.address].usdDenominatedValue =
      tokenPricesMappingTable["grail"] *
      (finalizableRewards[this.grailContract.address].balance.toString() /
        10 ** 18);

    finalizableRewards[this.xgrailContract.address].usdDenominatedValue =
      tokenPricesMappingTable["xgrail"] *
      (finalizableRewards[this.xgrailContract.address].balance.toString() /
        10 ** 18);

    return finalizableRewards;
  }
  async customRedeemVestingRewards(pendingRewards, owner) {
    const response = await axios.get(
      `https://api.camelot.exchange/campaigns/rewards?chainId=${this.chainId}&user=${owner}`,
    );
    const data = response.data;
    for (const reward of data.data.rewards) {
      if (Number(reward.positionIdentifierDecoded) === this.token_id) {
        const claimableAmount = Number(reward.rewards) - Number(reward.claimed);
        const vestingDuration = 15552000;
        const harvestTxn = prepareContractCall({
          contract: this.rewardContract,
          method: "harvest",
          params: [
            owner,
            reward.poolAddress,
            reward.tokenAddress,
            claimableAmount,
            reward.positionIdentifier,
            reward.proof,
          ],
        });
        const redeemTxn = prepareContractCall({
          contract: this.xgrailContract,
          method: "redeem",
          params: [claimableAmount, vestingDuration],
        });
        return [harvestTxn, redeemTxn];
      }
    }
    return [];
  }
  async finalizeRedeem(owner, pendingRewards) {
    // TODO, need to call this function in BasePortolio
    const finalizeTxns = [];
    for (const index of pendingRewards[this.grailContract.address]
      .finalizableIndexes) {
      const userRedeem = await this.xgrailContractInstance.functions.userRedeem(
        owner,
        index,
      );
      finalizeTxns.push(
        prepareContractCall({
          contract: this.xgrailContract,
          method: "finalizeRedeem",
          params: [index],
        }),
      );
      pendingRewards[this.grailContract.address].balance = pendingRewards[
        this.grailContract.address
      ].balance.add(userRedeem.grailAmount);
    }
    return finalizeTxns;
  }
}
