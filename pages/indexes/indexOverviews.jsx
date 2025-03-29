// copy from this Tailwind template: https://tailwindui.com/components/application-ui/page-examples/detail-screens
"use client";
import BasePage from "../basePage.tsx";
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useDispatch, useSelector } from "react-redux";
import { ShieldCheckIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/router";
import { base, arbitrum, optimism } from "thirdweb/chains";
import PopUpModal from "../Modal";
import {
  TOKEN_ADDRESS_MAP,
  CHAIN_ID_TO_CHAIN,
  CHAIN_TO_CHAIN_ID,
  CHAIN_ID_TO_CHAIN_STRING,
} from "../../utils/general.js";
import {
  Button,
  ConfigProvider,
  Radio,
  notification,
  Spin,
  Tabs,
  Dropdown,
  Popover,
  Space,
} from "antd";
import {
  useActiveAccount,
  useSendBatchTransaction,
  useActiveWalletChain,
  useWalletBalance,
  useSwitchActiveWalletChain,
} from "thirdweb/react";
import { getPortfolioHelper } from "../../utils/thirdwebSmartWallet.ts";
import axios from "axios";
import openNotificationWithIcon from "../../utils/notification.js";
import APRComposition from "../views/components/APRComposition";
import { fetchStrategyMetadata } from "../../lib/features/strategyMetadataSlice.js";
import { generateIntentTxns } from "../../classes/main.js";
import { SettingOutlined, DownOutlined } from "@ant-design/icons";
import THIRDWEB_CLIENT from "../../utils/thirdweb";
import { isAddress } from "ethers/lib/utils";
import styles from "../../styles/indexOverviews.module.css";
import tokens from "../views/components/tokens.json";
import useTabItems from "../../hooks/useTabItems";
import PortfolioSummary from "../portfolio/PortfolioSummary";
import PortfolioComposition from "../portfolio/PortfolioComposition";
import HistoricalData from "../portfolio/HistoricalData";
import TransactionHistoryPanel from "../portfolio/TransactionHistoryPanel";
import {
  safeSetLocalStorage,
  safeGetLocalStorage,
} from "../../utils/localStorage";
import { determineSlippage } from "../../utils/slippage";
import {
  normalizeChainName,
  switchNextChain,
  getAvailableAssetChains,
  calCrossChainInvestmentAmount,
} from "../../utils/chainHelper";
import {
  getRebalanceReinvestUsdAmount,
  getTokenMetadata,
} from "../../utils/portfolioCalculation";
import { handleTransactionError } from "../../utils/transactionErrorHandler";
import {
  checkGasPrice,
  prepareTransactionMetadata,
  setActionLoadingState,
} from "../../utils/transactionHelpers.js";

// Extract chain switching logic
const useChainSwitching = (chainId, switchChain) => {
  const isProcessingChainChangeRef = useRef(false);
  const hasProcessedChainChangeRef = useRef(false);

  const switchItems = [
    {
      key: "1",
      label: (
        <Button type="link" onClick={() => switchChain(arbitrum)}>
          <Image
            src={`/chainPicturesWebp/arbitrum.webp`}
            alt="arbitrum"
            height={22}
            width={22}
            className="rounded-full"
          />
        </Button>
      ),
    },
    {
      key: "2",
      label: (
        <Button type="link" onClick={() => switchChain(base)}>
          <Image
            src={`/chainPicturesWebp/base.webp`}
            alt="base"
            height={22}
            width={22}
            className="rounded-full"
          />
        </Button>
      ),
    },
    {
      key: "3",
      label: (
        <Button type="link" onClick={() => switchChain(optimism)}>
          <Image
            src={`/chainPicturesWebp/optimism.webp`}
            alt="optimism"
            height={22}
            width={22}
            className="rounded-full"
          />
        </Button>
      ),
    },
  ];

  // Chain mapping for switching
  const chainMap = {
    arbitrum: arbitrum,
    base: base,
    op: optimism,
  };

  const switchNextStepChain = (chain) => {
    const selectedChain = chainMap[chain];
    if (selectedChain) {
      switchChain(selectedChain);
    } else {
      console.error(`Invalid chain: ${chain}`);
    }
  };

  return {
    switchItems,
    switchNextStepChain,
    isProcessingChainChangeRef,
    hasProcessedChainChangeRef,
    chainMap,
  };
};

export default function IndexOverviews() {
  const router = useRouter();
  const { portfolioName } = router.query;
  const account = useActiveAccount();
  const chainId = useActiveWalletChain();
  const switchChain = useSwitchActiveWalletChain();

  // Use the extracted chain switching logic
  const {
    switchItems,
    switchNextStepChain,
    isProcessingChainChangeRef,
    hasProcessedChainChangeRef,
  } = useChainSwitching(chainId, switchChain);

  const [selectedToken, setSelectedToken] = useState(null);
  const [previousTokenSymbol, setPreviousTokenSymbol] = useState(null);
  const [investmentAmount, setInvestmentAmount] = useState(0);
  const [zapInIsLoading, setZapInIsLoading] = useState(false);
  const [zapOutIsLoading, setZapOutIsLoading] = useState(false);
  const [transferLoading, setTransferLoading] = useState(false);
  const [rebalanceIsLoading, setRebalanceIsLoading] = useState(false);
  const [
    protocolAssetDustInWalletLoading,
    setProtocolAssetDustInWalletLoading,
  ] = useState(false);
  const [actionName, setActionName] = useState("");
  const [onlyThisChain, setOnlyThisChain] = useState(false);
  const [totalTradingLoss, setTotalTradingLoss] = useState(0);
  const [tradingLoss, setTradingLoss] = useState(0);
  const [platformFee, setPlatformFee] = useState(0);
  const [costsCalculated, setCostsCalculated] = useState(false);
  const [stepName, setStepName] = useState("");
  const [slippage, setSlippage] = useState(() =>
    determineSlippage({ portfolioName }),
  );
  const [zapOutPercentage, setZapOutPercentage] = useState(0);
  const [usdBalance, setUsdBalance] = useState(0);
  const [pendingRewards, setPendingRewards] = useState(0);
  const [rebalancableUsdBalanceDict, setrebalancableUsdBalanceDict] = useState(
    {},
  );
  const [recipient, setRecipient] = useState("");
  const [protocolAssetDustInWallet, setProtocolAssetDustInWallet] = useState(
    {},
  );

  const [usdBalanceLoading, setUsdBalanceLoading] = useState(false);
  const [pendingRewardsLoading, setPendingRewardsLoading] = useState(false);
  const [
    rebalancableUsdBalanceDictLoading,
    setrebalancableUsdBalanceDictLoading,
  ] = useState(false);

  const [principalBalance, setPrincipalBalance] = useState(0);
  const [open, setOpen] = useState(false);
  const [finishedTxn, setFinishedTxn] = useState(false);
  const [txnLink, setTxnLink] = useState("");
  const [tokenPricesMappingTable, setTokenPricesMappingTable] = useState({});
  const [tabKey, setTabKey] = useState("");
  const [lockUpPeriod, setLockUpPeriod] = useState(0);

  const [notificationAPI, notificationContextHolder] =
    notification.useNotification();
  const [recipientError, setRecipientError] = useState(false);
  const [showZapIn, setShowZapIn] = useState(false);

  const preservedAmountRef = useRef(null);

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleSetSelectedToken = useCallback((token) => {
    setSelectedToken(token);
    setPreviousTokenSymbol(token.split("-")[0].toLowerCase());
  }, []);
  const handleSetInvestmentAmount = useCallback((amount) => {
    setInvestmentAmount(amount);
  }, []);
  const portfolioHelper = getPortfolioHelper(portfolioName);
  const { mutate: sendBatchTransaction } = useSendBatchTransaction();
  const {
    strategyMetadata: portfolioApr,
    loading,
    error,
  } = useSelector((state) => state.strategyMetadata);
  const dispatch = useDispatch();

  const handleAAWalletAction = async (actionName, onlyThisChain = false) => {
    const isGasPriceAcceptable = await checkGasPrice({
      chainId,
      THIRDWEB_CLIENT,
      notificationAPI,
    });
    if (!isGasPriceAcceptable) {
      return;
    }

    setOpen(true);
    setActionName(actionName);
    setOnlyThisChain(onlyThisChain);
    setCostsCalculated(false);
    setFinishedTxn(false);
    setPlatformFee(0);
    setTotalTradingLoss(0);
    setTradingLoss(0);
    setStepName("");

    const tokenSymbolAndAddress = selectedToken.toLowerCase();

    if (!tokenSymbolAndAddress) {
      alert("Please select a token");
      return;
    }
    setActionLoadingState({
      actionName,
      setZapInIsLoading,
      setZapOutIsLoading,
      setRebalanceIsLoading,
      setTransferLoading,
      isLoading: true,
    });
    if (!account) return;
    const [tokenSymbol, tokenAddress, tokenDecimals] =
      tokenSymbolAndAddress.split("-");
    try {
      const txns = await generateIntentTxns(
        actionName,
        chainId?.name === undefined
          ? { name: CHAIN_ID_TO_CHAIN_STRING[chainId?.id], ...chainId }
          : chainId,
        portfolioHelper,
        account.address,
        tokenSymbol,
        tokenAddress,
        investmentAmount,
        tokenDecimals,
        zapOutPercentage,
        setTradingLoss,
        setStepName,
        setTotalTradingLoss,
        setPlatformFee,
        slippage,
        rebalancableUsdBalanceDict,
        recipient,
        protocolAssetDustInWallet[normalizeChainName(chainId?.name)],
        onlyThisChain,
        usdBalance,
      );
      setCostsCalculated(true);
      if (
        [
          "zapIn",
          "zapOut",
          "crossChainRebalance",
          "localRebalance",
          "transfer",
        ].includes(actionName) &&
        txns.length < 2
      ) {
        throw new Error("No transactions to send");
      }

      // Reset the processing flag before changing chain
      hasProcessedChainChangeRef.current = false;
      preservedAmountRef.current = investmentAmount;
      const investmentAmountAfterFee =
        investmentAmount *
        (1 - portfolioHelper.swapFeeRate()) *
        (1 - slippage / 100);
      const chainWeight = calCrossChainInvestmentAmount(
        normalizeChainName(chainId?.name),
      );
      const chainWeightPerYourPortfolio =
        Object.values(rebalancableUsdBalanceDict)
          .filter(({ chain }) => chain === normalizeChainName(chainId?.name))
          .reduce((sum, value) => sum + value.usdBalance, 0) / usdBalance;

      // Call sendBatchTransaction and wait for the result
      await new Promise((resolve, reject) => {
        sendBatchTransaction(txns.flat(Infinity), {
          onSuccess: async (data) => {
            const explorerUrl =
              data?.chain?.blockExplorers !== undefined
                ? data.chain.blockExplorers[0].url
                : `https://explorer.${CHAIN_ID_TO_CHAIN_STRING[
                    chainId?.id
                  ].toLowerCase()}.io`;

            // First update chainStatus
            setChainStatus((prevStatus) => {
              const newStatus = { ...prevStatus, [currentChain]: true };
              const allChainsComplete = Object.values(newStatus).every(Boolean);

              if (allChainsComplete) {
                localStorage.removeItem(
                  `portfolio-${portfolioName}-${account.address}`,
                );
              }

              // Find next chain for notification
              const nextChain = Object.entries(newStatus).find(
                ([chain, isComplete]) => !isComplete,
              )?.[0];

              // Create notification content with image
              const notificationContent = allChainsComplete ? (
                "All Chains Complete"
              ) : (
                <div className="flex items-center gap-2">
                  Continue with
                  <img
                    src={`/chainPicturesWebp/${nextChain?.toLowerCase()}.webp`}
                    alt={nextChain}
                    style={{
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                    }}
                  />
                </div>
              );

              openNotificationWithIcon(
                notificationAPI,
                notificationContent,
                allChainsComplete ? "success" : "warning",
                `${explorerUrl}/tx/${data.transactionHash}`,
              );

              return newStatus;
            });

            // Continue with other state updates
            setFinishedTxn(true);
            const newNextChain = switchNextChain(data.chain.name);
            setNextStepChain(newNextChain);
            setTxnLink(`${explorerUrl}/tx/${data.transactionHash}`);

            await axios({
              method: "post",
              url: `${process.env.NEXT_PUBLIC_API_URL}/transaction/category`,
              headers: {
                "Content-Type": "application/json",
              },
              data: {
                user_api_key: "placeholder",
                tx_hash: data.transactionHash,
                address: account.address,
                metadata: JSON.stringify(
                  prepareTransactionMetadata({
                    portfolioName,
                    actionName,
                    tokenSymbol,
                    investmentAmountAfterFee,
                    zapOutPercentage,
                    chainId,
                    chainWeightPerYourPortfolio,
                    usdBalance,
                    chainWeight,
                    rebalancableUsdBalanceDict,
                    pendingRewards,
                    portfolioHelper,
                    currentChain,
                    recipient,
                    protocolAssetDustInWallet,
                    onlyThisChain,
                  }),
                ),
              },
            });

            if (actionName === "transfer") {
              await axios({
                method: "post",
                url: `${process.env.NEXT_PUBLIC_API_URL}/transaction/category`,
                headers: {
                  "Content-Type": "application/json",
                },
                data: {
                  user_api_key: "placeholder",
                  tx_hash: data.transactionHash,
                  address: recipient,
                  metadata: JSON.stringify({
                    portfolioName,
                    actionName: "receive",
                    tokenSymbol,
                    investmentAmount: investmentAmountAfterFee,
                    timestamp: Math.floor(Date.now() / 1000),
                    chain: CHAIN_ID_TO_CHAIN_STRING[chainId?.id].toLowerCase(),
                    zapInAmountOnThisChain:
                      usdBalance *
                      zapOutPercentage *
                      chainWeightPerYourPortfolio,
                    sender: account.address,
                  }),
                },
              });
            }
          },
          onError: (error) => {
            handleTransactionError(error, notificationAPI, {
              onComplete: () => reject(error), // Reject the promise with the error
            });
          },
        });
      }).catch((error) => {
        // This catch will handle the rejected promise from onError
        // No need to call handleTransactionError again as it was already called
        console.error("Transaction failed:", error);
      });
    } catch (error) {
      // This handles errors that occur before the transaction is sent
      handleTransactionError(error, notificationAPI, {
        onComplete: () => {
          // Any cleanup needed after error handling
          setZapInIsLoading(false);
          setZapOutIsLoading(false);
          setRebalanceIsLoading(false);
          setTransferLoading(false);
        },
      });
    } finally {
      // Reset all loading states regardless of success or failure
      setActionLoadingState({
        actionName,
        setZapInIsLoading,
        setZapOutIsLoading,
        setRebalanceIsLoading,
        setTransferLoading,
        isLoading: false,
      });
    }
  };

  const [nextStepChain, setNextStepChain] = useState("");

  const currentChain = normalizeChainName(chainId?.name);
  // get all available chains
  const availableAssetChains = getAvailableAssetChains(portfolioHelper);
  // get chain status
  const [chainStatus, setChainStatus] = useState({
    base: false,
    arbitrum: false,
    op: false,
  });

  const [nextChainInvestmentAmount, setNextChainInvestmentAmount] = useState(0);

  const onChange = (key) => {
    setTabKey(key);
    const selectedTab = items.find((item) => item.key === key);
    const newSlippage = determineSlippage({
      portfolioName,
      tabLabel: selectedTab?.label,
      actionName,
    });
    setSlippage(newSlippage);
  };

  const tokenAddress = selectedToken?.split("-")[1];
  const { data: walletBalanceData, isLoading: walletBalanceLoading } =
    useWalletBalance({
      chain: chainId,
      address: account?.address,
      client: THIRDWEB_CLIENT,
      ...(tokenAddress === "0x0000000000000000000000000000000000000000" &&
      nextStepChain === ""
        ? {}
        : tokenAddress === "0x0000000000000000000000000000000000000000" &&
          nextStepChain !== ""
        ? {
            tokenAddress:
              TOKEN_ADDRESS_MAP["weth"][normalizeChainName(chainId?.name)],
          }
        : { tokenAddress }),
    });
  const [tokenBalance, setTokenBalance] = useState(0);
  const yieldContent = (
    <>
      {portfolioHelper?.description()}
      <br />
      Click{" "}
      <Link
        href="https://all-weather-protocol.gitbook.io/all-weather-protocol/vault-strategy/stablecoin-vault"
        target="_blank"
        className="text-blue-400"
      >
        here
      </Link>{" "}
      for more information
    </>
  );

  useEffect(() => {
    if (
      portfolioApr[portfolioName] === undefined ||
      Object.keys(portfolioApr).length === 0
    ) {
      dispatch(fetchStrategyMetadata());
    }

    if (portfolioName !== undefined) {
      const selectedTokenSymbol = selectedToken?.toLowerCase()?.split("-")[0];
      const newSlippage = determineSlippage({
        portfolioName,
        selectedTokenSymbol,
        tabLabel: items.find((item) => item.key === tabKey)?.label,
        actionName,
      });
      setSlippage(newSlippage);
    }
  }, [portfolioName, selectedToken, chainId, tabKey, actionName]);
  useEffect(() => {
    console.time("🚀 Portfolio data fetch");
    // Clear states on initial load/refresh
    setUsdBalance(0);
    setUsdBalanceLoading(true);
    setPendingRewardsLoading(true);
    setrebalancableUsdBalanceDictLoading(true);
    setProtocolAssetDustInWalletLoading(true);

    if (!portfolioName || account === undefined || !chainId) {
      return;
    }

    // Add guard against multiple chain change processing
    if (isProcessingChainChangeRef.current) {
      return;
    }
    const timeoutId = setTimeout(async () => {
      try {
        isProcessingChainChangeRef.current = true;
        // Check cache first
        const cachedData = safeGetLocalStorage(
          `portfolio-${portfolioName}-${account.address}`,
          portfolioHelper,
        );
        if (
          cachedData?.timestamp &&
          Date.now() - cachedData.timestamp < 86400 * 1000
        ) {
          // Use cached data - update states immediately for each piece of data
          setTokenPricesMappingTable(cachedData.tokenPricesMappingTable);
          setUsdBalance(cachedData.usdBalance);
          setUsdBalanceLoading(false);
          setrebalancableUsdBalanceDict(cachedData.usdBalanceDict);
          setrebalancableUsdBalanceDictLoading(false);

          setLockUpPeriod(cachedData.lockUpPeriod);

          setPendingRewards(cachedData.pendingRewards);
          setPendingRewardsLoading(false);

          setProtocolAssetDustInWallet(cachedData.dust);
          setProtocolAssetDustInWalletLoading(false);
          return;
        }

        // Fetch fresh data using Promise.all to load data in parallel

        // Start all async operations simultaneously
        const usdBalancePromise = portfolioHelper.usdBalanceOf(
          account.address,
          portfolioApr[portfolioName],
        );
        const lockUpPeriodPromise = portfolioHelper.lockUpPeriod(
          account.address,
        );

        try {
          const results = await Promise.all([
            usdBalancePromise.then((result) => {
              return result;
            }),
            lockUpPeriodPromise.then((result) => {
              return result;
            }),
          ]);
          console.timeEnd("🚀 Portfolio data fetch");

          const [
            [usdBalance, usdBalanceDict, tokenPricesMappingTable],
            lockUpPeriod,
          ] = results;

          setTokenPricesMappingTable(tokenPricesMappingTable);
          // Update USD balance and dict as soon as available
          setUsdBalance(usdBalance);
          setUsdBalanceLoading(false);
          setrebalancableUsdBalanceDict(usdBalanceDict);
          setrebalancableUsdBalanceDictLoading(false);

          // Update lockup period as soon as available
          setLockUpPeriod(lockUpPeriod);

          // Update pending rewards as soon as available
          console.time("🚀 Pending rewards fetch");
          const pendingRewards = await portfolioHelper.pendingRewards(
            account.address,
            () => {},
            tokenPricesMappingTable,
          );
          console.timeEnd("🚀 Pending rewards fetch");
          setPendingRewards(pendingRewards.pendingRewardsDict);
          setPendingRewardsLoading(false);

          // Calculate dust after token prices are available
          const dust =
            await portfolioHelper.calProtocolAssetDustInWalletDictionary(
              account.address,
              tokenPricesMappingTable,
            );
          setProtocolAssetDustInWallet(dust);
          setProtocolAssetDustInWalletLoading(false);

          // Update final USD balance with dust
          const dustTotalUsdBalance = Object.values(dust).reduce(
            (sum, protocolObj) =>
              sum +
              Object.values(protocolObj).reduce(
                (protocolSum, asset) =>
                  protocolSum + (Number(asset.assetUsdBalanceOf) || 0),
                0,
              ),
            0,
          );
          setUsdBalance(usdBalance + dustTotalUsdBalance);

          // Cache the fresh data
          try {
            safeSetLocalStorage(
              `portfolio-${portfolioName}-${account.address}`,
              {
                tokenPricesMappingTable,
                usdBalance: usdBalance + dustTotalUsdBalance,
                usdBalanceDict,
                lockUpPeriod: lockUpPeriod,
                pendingRewards: pendingRewards.pendingRewardsDict,
                dust,
                timestamp: Date.now(),
              },
            );
          } catch (error) {
            console.warn("Failed to cache portfolio data:", error);
          }
        } catch (error) {
          console.error("❌ Error fetching portfolio data:", {
            message: error.message,
            stack: error.stack,
          });
          throw error;
        }
      } finally {
        isProcessingChainChangeRef.current = false;
      }
    }, 500);

    return () => {
      clearTimeout(timeoutId);
      isProcessingChainChangeRef.current = false;
    };
  }, [portfolioName, account, chainId, refreshTrigger]);
  useEffect(() => {
    return () => {
      isProcessingChainChangeRef.current = false;
      hasProcessedChainChangeRef.current = false;
    };
  }, []);
  useEffect(() => {
    const balance = walletBalanceData?.displayValue;
    setTokenBalance(balance);
  }, [selectedToken, walletBalanceData, investmentAmount]);

  const validateRecipient = (address) => {
    if (address === account?.address) {
      setRecipientError(true);
      return;
    }
    const isValid = isAddress(address);
    setRecipientError(!isValid);
    setRecipient(address);
  };

  useEffect(() => {
    const getDefaultTokenMetadata = () => {
      if (previousTokenSymbol) {
        const tokenSymbol =
          previousTokenSymbol === "eth" && nextStepChain !== ""
            ? "weth"
            : previousTokenSymbol;
        const metadata = getTokenMetadata(chainId, tokenSymbol, tokens);
        if (metadata) return { metadata, tokenSymbol };
      }
      return {
        metadata: getTokenMetadata(chainId, "usdc", tokens),
        tokenSymbol: "usdc",
      };
    };

    try {
      isProcessingChainChangeRef.current = true;

      const { metadata, tokenSymbol } = getDefaultTokenMetadata();

      if (metadata) {
        // For ETH -> WETH conversion
        if (previousTokenSymbol === "eth" && tokenSymbol === "weth") {
          if (!hasProcessedChainChangeRef.current && investmentAmount > 0) {
            preservedAmountRef.current = investmentAmount;
            hasProcessedChainChangeRef.current = true;
          }
        }

        setSelectedToken(metadata);

        // Use preserved amount if available
        if (preservedAmountRef.current !== null) {
          setInvestmentAmount(preservedAmountRef.current);
        }
      }
    } finally {
      // Reset processing flag after a short delay
      setTimeout(() => {
        isProcessingChainChangeRef.current = false;
      }, 100);
    }
  }, [chainId, previousTokenSymbol, nextStepChain]);

  // Add this function outside useEffect
  const handleRefresh = useCallback(async () => {
    if (!portfolioName || !account?.address) return;

    // Clear cached data
    localStorage.removeItem(`portfolio-${portfolioName}-${account.address}`);

    // Reset states
    setUsdBalance(0);
    setUsdBalanceLoading(true);
    setPendingRewardsLoading(true);
    setrebalancableUsdBalanceDictLoading(true);
    setProtocolAssetDustInWalletLoading(true);

    // Trigger the useEffect by updating a dependency
    setRefreshTrigger(Date.now());
  }, [portfolioName, account]);

  const tabProps = {
    CHAIN_ID_TO_CHAIN,
    CHAIN_TO_CHAIN_ID,
    account,
    chainId,
    getRebalanceReinvestUsdAmount,
    handleAAWalletAction,
    handleSetInvestmentAmount,
    handleSetSelectedToken,
    investmentAmount,
    nextChainInvestmentAmount,
    nextStepChain,
    portfolioApr,
    portfolioHelper,
    portfolioName,
    protocolAssetDustInWallet,
    protocolAssetDustInWalletLoading,
    rebalancableUsdBalanceDict,
    rebalancableUsdBalanceDictLoading,
    rebalanceIsLoading,
    recipient,
    recipientError,
    selectedToken,
    setFinishedTxn,
    setInvestmentAmount,
    setNextChainInvestmentAmount,
    setPreviousTokenSymbol,
    setShowZapIn,
    setZapOutPercentage,
    showZapIn,
    switchChain,
    switchNextStepChain,
    tokenBalance,
    tokenPricesMappingTable,
    transferLoading,
    usdBalance,
    usdBalanceLoading,
    validateRecipient,
    walletBalanceData,
    zapInIsLoading,
    zapOutIsLoading,
    zapOutPercentage,
    pendingRewards,
    pendingRewardsLoading,
    availableAssetChains,
    chainStatus,
    onRefresh: handleRefresh,
    lockUpPeriod,
  };

  const items = useTabItems({
    ...tabProps,
    // Add setSlippage to tabProps
    setSlippage,
    // Add portfolioName to tabProps if not already included
    portfolioName,
  });
  return (
    <BasePage>
      {notificationContextHolder}
      <PopUpModal
        account={account}
        portfolioHelper={portfolioHelper}
        stepName={stepName}
        tradingLoss={tradingLoss}
        totalTradingLoss={totalTradingLoss}
        open={open ?? false}
        setOpen={setOpen}
        chainId={
          chainId?.name === undefined
            ? { name: CHAIN_ID_TO_CHAIN_STRING[chainId?.id], ...chainId }
            : chainId
        }
        finishedTxn={finishedTxn}
        txnLink={txnLink}
        portfolioAPR={portfolioApr[portfolioName]?.portfolioAPR}
        actionName={actionName}
        onlyThisChain={onlyThisChain}
        selectedToken={selectedToken}
        investmentAmount={investmentAmount}
        costsCalculated={costsCalculated}
        platformFee={platformFee}
        rebalancableUsdBalanceDict={rebalancableUsdBalanceDict}
        chainMetadata={chainId}
        rebalanceAmount={getRebalanceReinvestUsdAmount(
          chainId?.name,
          rebalancableUsdBalanceDict,
          pendingRewards,
          portfolioHelper,
        )}
        zapOutAmount={usdBalance * zapOutPercentage}
        availableAssetChains={availableAssetChains}
        currentChain={currentChain}
        chainStatus={chainStatus || {}}
        currentTab={tabKey}
        allChainsComplete={Object.values(chainStatus || {}).every(Boolean)}
      />
      <main className={styles.bgStyle}>
        <header className="relative isolate pt-6">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <div className="sm:flex items-center justify-between gap-x-6">
              <div className="flex items-center">
                <img
                  alt=""
                  src={`/indexFunds/${encodeURIComponent(
                    portfolioName?.toLowerCase(),
                  )}.webp`}
                  onError={(e) => {
                    e.target.onerror = null; // Prevent infinite loop
                    e.target.src = "/tokenPictures/usdc.webp";
                  }}
                  className="h-8 w-8 rounded-full me-2"
                />
                <h1 className="text-2xl font-bold text-white" role="vault">
                  {portfolioName}
                </h1>
              </div>
              <div className="flex items-center justify-between sm:justify-normal gap-x-8 text-white mt-3 sm:mt-0">
                <div className="flex items-center space-x-2">
                  <ShieldCheckIcon
                    aria-hidden="true"
                    className="h-6 w-6 text-green-600"
                  />
                  <Popover
                    content="All Weather Protocol is a zero-smart-contract protocol. It's a pure JavaScript project built with an Account Abstraction (AA) wallet. Here is the audit report for the AA wallet."
                    trigger="hover"
                  >
                    <span className="text-white">
                      Audit Report:{" "}
                      <a
                        href="https://thirdweb.com/explore/smart-wallet"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 underline"
                      >
                        View here
                      </a>
                    </span>
                  </Popover>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">
                    $ {portfolioApr[portfolioName]?.portfolioTVL}
                  </p>
                  <p className="font-medium">TVL</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold" role="apr">
                    {loading === true ? (
                      <Spin />
                    ) : (
                      (portfolioApr[portfolioName]?.portfolioAPR * 100).toFixed(
                        2,
                      )
                    )}
                    %
                    <APRComposition
                      APRData={pendingRewards}
                      mode="pendingRewards"
                      currency="$"
                      exchangeRateWithUSD={1}
                      pendingRewardsLoading={pendingRewardsLoading}
                    />
                  </p>
                  <p className="font-medium">APR</p>
                </div>
              </div>
            </div>
          </div>
        </header>
        <div className="mx-auto max-w-7xl p-6">
          <div className="mb-8 p-4 border border-white/50 relative">
            <div className="flex items-center justify-end">
              <div className="w-20 h-8 flex items-center justify-center rounded-md bg-white text-black">
                <span className="me-2">{slippage}%</span>
                <Dropdown
                  dropdownRender={() => (
                    <div className="bg-gray-700 text-white rounded-xl p-4 shadow-lg space-y-4 pb-6">
                      <p>Max Slippage: </p>
                      <Radio.Group
                        value={slippage}
                        buttonStyle="solid"
                        size="small"
                        onChange={(e) => setSlippage(e.target.value)}
                      >
                        {[2, 3, 5, 7].map((slippageValue) => (
                          <Radio.Button
                            value={slippageValue}
                            key={slippageValue}
                          >
                            {slippageValue}%
                          </Radio.Button>
                        ))}
                      </Radio.Group>
                    </div>
                  )}
                  trigger={["click"]}
                  placement="bottom"
                >
                  <a className="text-black" onClick={(e) => e.preventDefault()}>
                    <SettingOutlined />
                  </a>
                </Dropdown>
              </div>
              <div>
                <Dropdown
                  menu={{
                    items: switchItems,
                  }}
                  trigger="click"
                >
                  <Button onClick={(e) => e.preventDefault()}>
                    <Space>
                      <Image
                        src={
                          chainId?.name
                            ? `/chainPicturesWebp/${normalizeChainName(
                                chainId?.name,
                              )}.webp`
                            : "/chainPicturesWebp/arbitrum.webp"
                        }
                        alt={chainId ? chainId.name : "arbitrum"}
                        height={22}
                        width={22}
                        className="rounded-full ms-1"
                      />
                      <DownOutlined />
                    </Space>
                  </Button>
                </Dropdown>
              </div>
            </div>
            <ConfigProvider
              theme={{
                components: {
                  Tabs: {
                    horizontalItemGutter: 16,
                  },
                },
                token: {
                  colorBgContainerDisabled: "rgb(156, 163, 175)",
                },
              }}
            >
              <Tabs
                className="text-white"
                defaultActiveKey="1"
                items={items}
                onChange={onChange}
              />
            </ConfigProvider>

            <div className="mt-2 flex align-items-center">
              ⛽<span className="text-emerald-400">Free</span>
            </div>
          </div>
          <div className="mx-auto grid max-w-2xl grid-cols-1 grid-rows-1 items-start gap-x-8 gap-y-8 lg:mx-0 lg:max-w-none lg:grid-cols-3">
            <PortfolioSummary
              usdBalanceLoading={usdBalanceLoading}
              tokenPricesMappingTable={tokenPricesMappingTable}
              usdBalance={usdBalance}
              account={account}
              principalBalance={principalBalance}
              onRefresh={handleRefresh}
              rebalancableUsdBalanceDict={rebalancableUsdBalanceDict}
            />

            <PortfolioComposition
              portfolioName={portfolioName}
              portfolioHelper={portfolioHelper}
              portfolioApr={portfolioApr}
              loading={loading}
              usdBalanceLoading={usdBalanceLoading}
              lockUpPeriod={lockUpPeriod}
              yieldContent={yieldContent}
            />

            <HistoricalData portfolioName={portfolioName} />

            <TransactionHistoryPanel
              setPrincipalBalance={setPrincipalBalance}
              tokenPricesMappingTable={tokenPricesMappingTable}
            />
          </div>
        </div>
      </main>
    </BasePage>
  );
}
