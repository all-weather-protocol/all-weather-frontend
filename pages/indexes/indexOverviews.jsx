// copy from this Tailwind template: https://tailwindui.com/components/application-ui/page-examples/detail-screens
"use client";
import BasePage from "../basePage.tsx";
import { useState, useCallback, useEffect, useRef } from "react";
import { ethers5Adapter } from "thirdweb/adapters/ethers5";
import Link from "next/link";
import { Signer } from "ethers";
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
  ConfigProvider,
  Radio,
  notification,
  Spin,
  Tabs,
  Dropdown,
  Popover,
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
import { SettingOutlined } from "@ant-design/icons";
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
} from "../../utils/transactionHelpers.js";
import { getNextChain } from "../../utils/chainOrder";

// Extract chain switching logic
const useChainSwitching = (switchChain) => {
  const isProcessingChainChangeRef = useRef(false);
  const hasProcessedChainChangeRef = useRef(false);

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
    switchNextStepChain,
    isProcessingChainChangeRef,
    hasProcessedChainChangeRef,
    chainMap,
  };
};
const cleanupActionParams = (params) => {
  const cleanedParams = { ...params };

  // Clean up rebalancableUsdBalanceDict
  for (const key in cleanedParams.rebalancableUsdBalanceDict) {
    if (cleanedParams.rebalancableUsdBalanceDict[key].protocol) {
      delete cleanedParams.rebalancableUsdBalanceDict[key].protocol;
    }
  }

  // Remove non-serializable properties
  const propertiesToRemove = [
    "portfolioHelper",
    "chainMetadata",
    "setPlatformFee",
    "setTotalTradingLoss",
    "setTradingLoss",
  ];

  propertiesToRemove.forEach((prop) => {
    delete cleanedParams[prop];
  });

  return cleanedParams;
};
export default function IndexOverviews() {
  const router = useRouter();
  const { portfolioName } = router.query;
  const account = useActiveAccount();
  const chainId = useActiveWalletChain();
  const switchChain = useSwitchActiveWalletChain();

  // Use the extracted chain switching logic
  const {
    switchNextStepChain,
    isProcessingChainChangeRef,
    hasProcessedChainChangeRef,
  } = useChainSwitching(switchChain);

  const [selectedToken, setSelectedToken] = useState(null);
  const [previousTokenSymbol, setPreviousTokenSymbol] = useState(null);
  const [investmentAmount, setInvestmentAmount] = useState(0);
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
  const [slippage, setSlippage] = useState(() =>
    determineSlippage({ portfolioName }),
  );
  const [zapOutPercentage, setZapOutPercentage] = useState(0);
  const [usdBalance, setUsdBalance] = useState(0);
  const [pendingRewards, setPendingRewards] = useState(0);
  const [rebalancableUsdBalanceDict, setRebalancableUsdBalanceDict] = useState(
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
    setRebalancableUsdBalanceDictLoading,
  ] = useState(false);

  const [principalBalance, setPrincipalBalance] = useState(0);
  const [open, setOpen] = useState(false);
  const [finishedTxn, setFinishedTxn] = useState(false);
  const [txnLink, setTxnLink] = useState("");
  const [tokenPricesMappingTable, setTokenPricesMappingTable] = useState({});
  const [tabKey, setTabKey] = useState("");
  const [lockUpPeriod, setLockUpPeriod] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
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
      return false;
    }

    setOpen(true);
    setActionName(actionName);
    setOnlyThisChain(onlyThisChain);
    setCostsCalculated(false);
    setFinishedTxn(false);
    setPlatformFee(0);
    setTotalTradingLoss(0);
    setTradingLoss(0);

    const tokenSymbolAndAddress = selectedToken.toLowerCase();

    if (!tokenSymbolAndAddress) {
      alert("Please select a token");
      return false;
    }
    if (!account) return false;

    const [tokenSymbol, tokenAddress, tokenDecimals] =
      tokenSymbolAndAddress.split("-");
    const actionParams = {
      actionName,
      chainMetadata:
        chainId?.name === undefined
          ? { name: CHAIN_ID_TO_CHAIN_STRING[chainId?.id], ...chainId }
          : chainId,
      portfolioHelper,
      accountAddress: account.address,
      tokenSymbol,
      tokenAddress,
      investmentAmount,
      tokenDecimals,
      zapOutPercentage,
      setTradingLoss,
      setTotalTradingLoss,
      setPlatformFee,
      slippage,
      rebalancableUsdBalanceDict,
      recipient,
      protocolAssetDustInWallet:
        protocolAssetDustInWallet?.[normalizeChainName(chainId?.name)] || {},
      protocolAssetDustInWalletLoading,
      onlyThisChain,
      usdBalance,
    };

    const handleError = async (error, context) => {
      const errorMessage = await handleTransactionError(
        context,
        error,
        notificationAPI,
        account?.address,
        chainId?.name,
        actionName,
        cleanupActionParams(actionParams),
      );
      if (errorMessage) {
        setErrorMsg(errorMessage);
      }
      return false;
    };

    try {
      const txns = await generateIntentTxns(actionParams);
      setErrorMsg("");
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
        portfolioHelper,
      );
      const chainWeightPerYourPortfolio =
        Object.values(rebalancableUsdBalanceDict)
          .filter(({ chain }) => chain === normalizeChainName(chainId?.name))
          .reduce((sum, value) => sum + value.usdBalance, 0) / usdBalance;

      // Return a promise that resolves when the transaction is successful
      return new Promise((resolve, reject) => {
        sendBatchTransaction(txns.flat(Infinity), {
          onSuccess: async (data) => {
            const explorerUrl =
              data?.chain?.blockExplorers !== undefined
                ? data.chain.blockExplorers[0].url
                : `https://explorer.${CHAIN_ID_TO_CHAIN_STRING[
                    chainId?.id
                  ].toLowerCase()}.io`;

            setChainStatus((prevStatus) => {
              const newStatus = { ...prevStatus, [currentChain]: true };
              const allChainsComplete = Object.values(newStatus).every(Boolean);

              if (allChainsComplete) {
                (async () => {
                  try {
                    await axios({
                      method: "delete",
                      url: `${process.env.NEXT_PUBLIC_SDK_API_URL}/portfolio-cache/portfolio-${portfolioName}-${account.address}`,
                    });
                  } catch (error) {
                    console.error("Failed to clear portfolio cache:", error);
                  }
                  setRefreshTrigger(Date.now());
                })();
              }

              const nextChain = Object.entries(newStatus).find(
                ([chain, isComplete]) => !isComplete,
              )?.[0];
              const notificationContent = allChainsComplete ? (
                "All Chains Complete"
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500">Completed on</span>
                    <div className="flex items-center gap-1">
                      <img
                        src={`/chainPicturesWebp/${currentChain?.toLowerCase()}.webp`}
                        alt={currentChain}
                        className="w-5 h-5 rounded-full"
                      />
                      <span className="font-medium">{currentChain}</span>
                    </div>
                    <span className="text-gray-500">→</span>
                    <div className="flex items-center gap-1">
                      <img
                        src={`/chainPicturesWebp/${nextChain?.toLowerCase()}.webp`}
                        alt={nextChain}
                        className="w-5 h-5 rounded-full"
                      />
                      <span className="font-medium">{nextChain}</span>
                    </div>
                  </div>
                </div>
              );

              openNotificationWithIcon(
                notificationAPI,
                notificationContent,
                allChainsComplete ? "success" : "info",
                `${explorerUrl}/tx/${data.transactionHash}`,
              );

              // Get the next chain using the updated status
              const newNextChain = getNextChain(
                availableAssetChains,
                newStatus,
                normalizeChainName(data.chain.name),
              );

              // Update the next chain state
              setNextStepChain(newNextChain);
              return newStatus;
            });

            setFinishedTxn(true);
            setTxnLink(`${explorerUrl}/tx/${data.transactionHash}`);

            await axios({
              method: "post",
              url: `${process.env.NEXT_PUBLIC_API_URL}/transaction/category`,
              headers: { "Content-Type": "application/json" },
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
                actionParams: cleanupActionParams(actionParams),
              },
            });

            if (actionName === "transfer") {
              await axios({
                method: "post",
                url: `${process.env.NEXT_PUBLIC_API_URL}/transaction/category`,
                headers: { "Content-Type": "application/json" },
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

            // Resolve the promise with true to indicate success
            resolve(true);
          },
          onError: async (error) => {
            reject(await handleError(error, "Transaction Failed"));
          },
        });
      });
    } catch (error) {
      return handleError(error, "Transaction Failed");
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

  // Handle tab changes
  const handleTabChange = (tabKey) => {
    setTabKey(tabKey);
    const newSlippage = determineSlippage({
      portfolioName,
      selectedTokenSymbol: selectedToken?.toLowerCase()?.split("-")[0],
      key: tabKey,
      actionName,
    });
    setSlippage(newSlippage);
  };

  // Handle slippage input changes
  const handleSlippageChange = (e) => {
    const newSlippage = e.target.value;
    setSlippage(newSlippage);
  };

  const tokenAddress = selectedToken?.split("-")[1];
  const { data: walletBalanceData } = useWalletBalance({
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
        key: tabKey,
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
    setRebalancableUsdBalanceDictLoading(true);
    setProtocolAssetDustInWalletLoading(true);

    if (!portfolioName || account === undefined || !chainId) {
      return;
    }

    // Add guard against multiple chain change processing
    if (isProcessingChainChangeRef.current) {
      return;
    }

    const fetchData = async () => {
      // TODO: use this signer to migrate to ZeroDev
      const signer = await ethers5Adapter.signer.toEthers({
        client: THIRDWEB_CLIENT,
        chain: chainId,
        account,
      });
      console.log(`Signer is signer: ${Signer.isSigner(signer)}`);
      try {
        isProcessingChainChangeRef.current = true;
        // Check cache first
        const cachedData = await safeGetLocalStorage(
          `portfolio-${portfolioName}-${account.address}`,
          portfolioHelper,
          notificationAPI,
        );

        if (
          cachedData?.timestamp &&
          Date.now() - cachedData.timestamp < 3600 * 1000
        ) {
          // Use cached data - update states immediately for each piece of data
          setTokenPricesMappingTable(cachedData.tokenPricesMappingTable);
          setUsdBalance(cachedData.usdBalance);
          setUsdBalanceLoading(false);
          setRebalancableUsdBalanceDict(cachedData.usdBalanceDict);
          setRebalancableUsdBalanceDictLoading(false);
          setLockUpPeriod(cachedData.lockUpPeriod);
          setPendingRewards(cachedData.pendingRewards);
          setPendingRewardsLoading(false);
          setProtocolAssetDustInWallet(cachedData.dust);
          setProtocolAssetDustInWalletLoading(false);
          return;
        }

        // Fetch fresh data using Promise.all to load data in parallel
        const usdBalancePromise = portfolioHelper.usdBalanceOf(
          account.address,
          portfolioApr[portfolioName],
        );
        const lockUpPeriodPromise = portfolioHelper.lockUpPeriod(
          account.address,
        );

        const results = await Promise.all([
          usdBalancePromise.then((result) => result),
          lockUpPeriodPromise.then((result) => result),
        ]);

        console.timeEnd("🚀 Portfolio data fetch");

        const [
          [usdBalance, usdBalanceDict, tokenPricesMappingTable],
          lockUpPeriod,
        ] = results;

        setTokenPricesMappingTable(tokenPricesMappingTable);
        setUsdBalance(usdBalance);
        setUsdBalanceLoading(false);
        setRebalancableUsdBalanceDict(usdBalanceDict);
        setLockUpPeriod(lockUpPeriod);

        // Update pending rewards
        console.time("🚀 Pending rewards fetch");
        const pendingRewards = await portfolioHelper.pendingRewards(
          account.address,
          () => {},
          tokenPricesMappingTable,
        );
        console.timeEnd("🚀 Pending rewards fetch");
        setPendingRewards(pendingRewards.pendingRewardsDict);
        setPendingRewardsLoading(false);

        // Calculate dust
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
          await safeSetLocalStorage(
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
            notificationAPI,
          );
        } catch (error) {
          console.warn("Failed to cache portfolio data:", error);
        }
        setErrorMsg("");
      } catch (error) {
        handleTransactionError(
          "Fetching Data Failed",
          error,
          notificationAPI,
          account?.address,
          chainId?.name,
          "fetchData",
          {},
        );
        setErrorMsg(error.message);
      } finally {
        isProcessingChainChangeRef.current = false;
      }
    };

    const timeoutId = setTimeout(fetchData, 500);

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
    await axios({
      method: "delete",
      url: `${process.env.NEXT_PUBLIC_SDK_API_URL}/portfolio-cache/portfolio-${portfolioName}-${account.address}`,
    });

    // Reset states
    setUsdBalance(0);
    setUsdBalanceLoading(true);
    setPendingRewardsLoading(true);
    setProtocolAssetDustInWalletLoading(true);

    // Trigger the useEffect by updating a dependency
    setRefreshTrigger(Date.now());
  }, [portfolioName, account]);

  const handleClose = () => {
    setTotalTradingLoss(0);
    setTradingLoss(0);
    setOpen(false);
  };

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
    recipient,
    recipientError,
    selectedToken,
    finishedTxn,
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
    usdBalance,
    usdBalanceLoading,
    validateRecipient,
    walletBalanceData,
    zapOutPercentage,
    pendingRewards,
    pendingRewardsLoading,
    availableAssetChains,
    chainStatus,
    onRefresh: handleRefresh,
    lockUpPeriod,
    rebalancableUsdBalanceDictLoading,
    errorMsg,
  };

  const items = useTabItems({
    ...tabProps,
    // Add setSlippage to tabProps
    setSlippage,
    // Add portfolioName to tabProps if not already included
    portfolioName,
  });
  return (
    <BasePage chainId={chainId} switchChain={switchChain}>
      {notificationContextHolder}
      <PopUpModal
        account={account}
        portfolioHelper={portfolioHelper}
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
        errorMsg={errorMsg}
        tokenPricesMappingTable={tokenPricesMappingTable}
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
                        onChange={handleSlippageChange}
                      >
                        {[0.5, 1, 2, 3, 5].map((slippageValue) => (
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
                onChange={handleTabChange}
              />
            </ConfigProvider>

            <div className="mt-2 flex align-items-center">
              ⛽<span className="text-emerald-400">Free</span>
            </div>
          </div>
          <div className="mx-auto grid max-w-2xl grid-cols-1 grid-rows-2 items-start gap-x-8 gap-y-8 lg:mx-0 lg:max-w-none lg:grid-cols-3">
            <PortfolioComposition
              portfolioName={portfolioName}
              portfolioHelper={portfolioHelper}
              portfolioApr={portfolioApr}
              loading={loading}
              usdBalanceLoading={usdBalanceLoading}
              lockUpPeriod={lockUpPeriod}
              yieldContent={yieldContent}
            />

            <PortfolioSummary
              usdBalanceLoading={usdBalanceLoading}
              tokenPricesMappingTable={tokenPricesMappingTable}
              usdBalance={usdBalance}
              account={account}
              principalBalance={principalBalance}
              onRefresh={handleRefresh}
              rebalancableUsdBalanceDict={rebalancableUsdBalanceDict}
              portfolioHelper={portfolioHelper}
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
