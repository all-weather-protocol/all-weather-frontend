import Hlp from "../../lib/contracts/Hmx/Hlp.json" assert { type: "json" };
import Vault from "../../lib/contracts/Hmx/Vault.json" assert { type: "json" };
import StakeHlp from "../../lib/contracts/Hmx/StakeHlp.json" assert { type: "json" };
import PriceHlp from "../../lib/contracts/Hmx/PriceHlp.json" assert { type: "json" };
import BaseProtocol from "../BaseProtocol";
import { getContract, prepareContractCall } from "thirdweb";
import THIRDWEB_CLIENT from "../../utils/thirdweb";
import { CHAIN_ID_TO_CHAIN, PROVIDER, approve } from "../../utils/general";
import { ethers } from "ethers";

export class Hmx extends BaseProtocol {
    constructor(chain, chainId, symbolList, mode, customParams) {
        super(chain, chainId, symbolList, mode, customParams);

        this.protocolName = "hmx";
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
            abi: Hlp,
        });
        this.protocolContract = getContract({
            client: THIRDWEB_CLIENT,
            address: customParams.protocolAddress,
            chain: CHAIN_ID_TO_CHAIN[this.chainId],
            abi: Vault,
        });
        this.stakeFarmContract = getContract({
            client: THIRDWEB_CLIENT,
            address: customParams.stakeFarmAddress,
            chain: CHAIN_ID_TO_CHAIN[this.chainId],
            abi: StakeHlp,
        });

        this.symbolOfBestTokenToZapOut = customParams.symbolOfBestTokenToZapOut;
        this.bestTokenAddressToZapOut = customParams.bestTokenAddressToZapOut;
        this.decimalOfBestTokenToZapOut = customParams.decimalOfBestTokenToZapOut;
        this.bestTokenToZapInDecimal = customParams.bestTokenToZapInDecimal;
    }

    rewards() {
        return this.customParams.rewards;
    }

    async pendingRewards(owner, tokenPricesMappingTable, updateProgress) {
        let rewardBalance = {};
        
        try {
            // Create contract instance directly with ethers
            const stakeFarmContract = new ethers.Contract(
                this.stakeFarmContract.address,
                StakeHlp,
                PROVIDER(this.chain)
            );
            
            // Get rewarders from the contract
            const rewarders = await stakeFarmContract.callStatic.getRewarders();
            
            // For each rewarder, get its pending rewards
            for (const rewarder of rewarders) {
                const rewarderContract = new ethers.Contract(
                    rewarder,
                    [
                        "function pendingReward(address user) view returns (uint256)",
                        "function rewardToken() view returns (address)"
                    ],
                    PROVIDER(this.chain)
                );
                
                try {
                    // Get reward token
                    const rewardToken = await rewarderContract.callStatic.rewardToken();
                    
                    // Create reward token contract to get symbol and decimals
                    const rewardTokenContract = new ethers.Contract(
                        rewardToken,
                        [
                            "function symbol() view returns (string)",
                            "function decimals() view returns (uint8)"
                        ],
                        PROVIDER(this.chain)
                    );
                    
                    // Get token info
                    const symbol = await rewardTokenContract.callStatic.symbol();
                    const decimals = await rewardTokenContract.callStatic.decimals();
                    // Get pending rewards
                    const pendingReward = await rewarderContract.callStatic.pendingReward(owner);
                    
                    if (pendingReward.gt(0)) {
                        // Convert amount using decimals
                        const amount = parseFloat(ethers.utils.formatUnits(pendingReward, decimals));
                        const price = tokenPricesMappingTable[symbol.toString().toLowerCase()] || 0;
                        const usdValue = amount * price;
                        rewardBalance[symbol] = {
                            amount: pendingReward.toString(),
                            decimals: decimals,
                            price: price,
                            usdValue: usdValue
                        };
                    }
                } catch (error) {
                    console.error(`Error getting rewards for rewarder ${rewarder}:`, error);
                }
            }
        } catch (error) {
            console.error("Error calculating pending rewards:", error);
        }
        
        console.log("rewardBalance", rewardBalance);
        return rewardBalance;
    }

    async _calculateExecutionFee() {
        try {
            // Get min execution fee from contract
            const protocolContractInstance = new ethers.Contract(
                this.protocolContract.address,
                Vault,
                PROVIDER(this.chain),
            );
            const minExecutionOrderFee = await protocolContractInstance.minExecutionOrderFee();
            
            // Validate the execution fee is within uint256 range
            const maxUint256 = ethers.BigNumber.from("2").pow(256).sub(1);
            if (minExecutionOrderFee.gt(maxUint256)) {
                console.error("Execution fee exceeds uint256 range");
                return "100000000000000";
            }
            
            return minExecutionOrderFee.toString();
        } catch (error) {
            console.error("Error calculating execution fee:", error);
            // Fallback to a safe default if contract call fails
            return "100000000000000";
        }
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
        const hlpPrice = await this._fetchHmxPrice();
        const inputTokenUsdValue =
            (tokenPricesMappingTable[inputToken] * amountToZapIn) /
            Math.pow(10, bestTokenToZapInDecimal);
        const estimatedHlpAmount = inputTokenUsdValue / hlpPrice;
        const estimatedHlpAmountBN = ethers.utils.parseUnits(estimatedHlpAmount.toString(), 18);
        const minHlpAmountBN = estimatedHlpAmountBN.mul(100 - slippage).div(100);
        const executionFeeStr = await this._calculateExecutionFee();
        const depositTxn = prepareContractCall({
            contract: this.protocolContract,
            method: "function createAddLiquidityOrder(address _tokenIn, uint256 _amountIn, uint256 _minOut, uint256 _executionFee, bool _shouldWrap, bool _isNotAutoStake)",
            params: [
                bestTokenAddressToZapIn,
                amountToZapIn,
                minHlpAmountBN.toString(),
                executionFeeStr,
                false,
                false
            ],
            value: executionFeeStr,
        });

        return [[approveTxn, depositTxn], 0];
    }

    async customClaim(owner, tokenPricesMappingTable, updateProgress) {
        const rewardContract = getContract({
            client: THIRDWEB_CLIENT,
            address: "0x388A954C6b7282427AA2E8AF504504Fa6bA89432",
            chain: CHAIN_ID_TO_CHAIN[this.chainId],
            abi: "",
        });
        const pendingRewards = await this.pendingRewards(owner, tokenPricesMappingTable, updateProgress);
        // function compound(address[] _lps, address[][] _rewards, uint256 _convertRatio, uint256 _minRec, bool _lockMgp)
        // _lps maybe is liquidity staking pool address
        // _rewards maybe is rewards token address
        // _convertRatio maybe is timestamp
        // _minRec maybe is max value, means claim all rewards
        // _lockMgp false
        const claimTxn = prepareContractCall({
            contract: rewardContract,
            method: "compound",
            params: [],
        });
        return [[claimTxn], pendingRewards];
    }

    async usdBalanceOf(owner, tokenPricesMappingTable) {
        const [hlpBalance, hlpPrice] = await Promise.all([
            this.stakeBalanceOf(owner, () => {}),
            this.assetUsdPrice(tokenPricesMappingTable),
        ]);
        return (
            (hlpBalance / Math.pow(10, this.assetDecimals)) * hlpPrice
        )
    }

    async assetUsdPrice(tokenPricesMappingTable) {  
        return await this._fetchHmxPrice();
    }

    async _fetchHmxPrice() {
        const hlpPriceContractInstance = new ethers.Contract(
            "0x0266868d1c144a7534513F38B816c1aadE4030A2",
            PriceHlp,
            PROVIDER(this.chain),
        );
        // getPrice() returns price in 18 decimals
        const getPrice = await hlpPriceContractInstance.getPrice();
        const price = parseFloat(ethers.utils.formatUnits(getPrice, 18));
        const roundedPrice = parseFloat(price.toFixed(4));
        return roundedPrice;
    }

    async stakeBalanceOf(owner) {
        try {
            const stakeContractInstance = new ethers.Contract(
                this.stakeFarmContract.address,
                StakeHlp,
                PROVIDER(this.chain),
            );
            const balance = await stakeContractInstance.userTokenAmount(owner);
            return balance;
        } catch (error) {
            console.error("Error in stakeBalanceOf:", error);
            return 0;
        }
    }

    _getTheBestTokenAddressToZapIn(inputToken, tokenAddress, InputTokenDecimals) {
        return [this.symbolOfBestTokenToZapOut, this.bestTokenAddressToZapOut, this.decimalOfBestTokenToZapOut];
    }

    _getTheBestTokenAddressToZapOut() {
        return [this.symbolOfBestTokenToZapOut, this.bestTokenAddressToZapOut, this.decimalOfBestTokenToZapOut];
    }

    async lockUpPeriod() {
        return 0;
    }

    async _stake(amount, updateProgress) {
        return [];
    }

    async _unstake(owner, percentage, updateProgress) {
        const percentageBN = ethers.BigNumber.from(
            BigInt(Math.floor(percentage * 10000)),
        );
        const stakeBalance = await this.stakeBalanceOf(owner, updateProgress);
        const amount = stakeBalance.mul(percentageBN).div(10000);
        const unstakeTxn = prepareContractCall({
            contract: this.stakeFarmContract,
            method: "withdraw",
            params: [amount],
        });
        return [[unstakeTxn], amount];
    }

    async customWithdrawAndClaim(
        owner,
        amount,
        slippage,
        tokenPricesMappingTable,
        updateProgress,
    ) {
        // First approve HLP token
        const approveHlpTxn = approve(
            this.assetContract.address,
            this.protocolContract.address,
            amount.toString(),
            updateProgress,
            this.chainId,
        );
        
        // Get HLP price for calculation
        const hlpPrice = await this._fetchHmxPrice();
        
        // Calculate USD value of HLP amount
        const hlpAmountInUsd = parseFloat(ethers.utils.formatUnits(amount, 18)) * hlpPrice;
        
        // Calculate minimum output amount in USD with slippage
        const minOutAmountUsd = hlpAmountInUsd * (100 - slippage) / 100;
        
        // Convert minOutAmount to wei (6 decimals for USD)
        const minOutAmount = ethers.utils.parseUnits(minOutAmountUsd.toFixed(6), 6);
        const [symbolOfBestTokenToZapOut, bestTokenAddressToZapOut, assetDecimals] = this._getTheBestTokenAddressToZapOut();
        const executionFeeStr = await this._calculateExecutionFee();
        
        // Create remove liquidity order
        const withdrawTxn = prepareContractCall({
            contract: this.protocolContract,
            method: "createRemoveLiquidityOrder",
            params: [
                bestTokenAddressToZapOut,  // token to receive
                amount.toString(),         // amount of HLP to burn
                minOutAmount.toString(),   // minimum amount to receive (in USD wei)
                executionFeeStr,           // execution fee
                false                      // isNativeOut
            ],
            value: executionFeeStr,
        });
        
        const tradingLoss = 0;
        await this.pendingRewards(owner, tokenPricesMappingTable, updateProgress);
        return [
            [approveHlpTxn, withdrawTxn],
            symbolOfBestTokenToZapOut,
            bestTokenAddressToZapOut,
            assetDecimals,
            minOutAmount,
            tradingLoss,
        ];
    }
}
