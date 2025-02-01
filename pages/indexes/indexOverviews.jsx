// copy from this Tailwind template: https://tailwindui.com/components/application-ui/page-examples/detail-screens
"use client";
import BasePage from "../basePage.tsx";
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useDispatch, useSelector } from "react-redux";
import { ShieldCheckIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/router";
import { base, arbitrum } from "thirdweb/chains";
import { getGasPrice } from "thirdweb";
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
import LZString from "lz-string";
import { ethers } from "ethers";

const safeSetLocalStorage = (key, value) => {
  try {
    const cacheData = {
      tokenPricesMappingTable: value.tokenPricesMappingTable,
      usdBalance: value.usdBalance,
      usdBalanceDict: value.usdBalanceDict,
      lockUpPeriod: value.lockUpPeriod,
      pendingRewards: value.pendingRewards,
      dust: {},
      timestamp: value.timestamp,
      __className: "PortfolioCache",
    };

    // Only store the uniqueId for protocol lookup
    if (value.dust) {
      Object.keys(value.dust).forEach((chain) => {
        if (value.dust[chain]) {
          cacheData.dust[chain] = {};
          Object.keys(value.dust[chain]).forEach((protocol) => {
            if (value.dust[chain][protocol]) {
              cacheData.dust[chain][protocol] = {
                assetBalance: value.dust[chain][protocol].assetBalance,
                assetUsdBalanceOf:
                  value.dust[chain][protocol].assetUsdBalanceOf,
                protocolId: value.dust[chain][protocol].protocol.uniqueId(),
              };
            }
          });
        }
      });
    }

    const compressedValue = LZString.compressToUTF16(JSON.stringify(cacheData));
    localStorage.setItem(key, compressedValue);
  } catch (e) {
    console.error("Error in safeSetLocalStorage:", e);
    throw e;
  }
};

const safeGetLocalStorage = (key, portfolioHelper) => {
  try {
    const compressed = localStorage.getItem(key);
    if (!compressed) {
      return null;
    }

    const decompressedData = JSON.parse(
      LZString.decompressFromUTF16(compressed),
    );

    if (decompressedData.__className === "PortfolioCache") {
      const { __className, ...cacheData } = decompressedData;

      // Reconstruct dust objects using protocolId
      if (cacheData.dust && portfolioHelper?.strategy) {
        Object.keys(cacheData.dust).forEach((chain) => {
          if (cacheData.dust[chain]) {
            Object.keys(cacheData.dust[chain]).forEach((protocol) => {
              if (cacheData.dust[chain][protocol]) {
                const cachedData = cacheData.dust[chain][protocol];
                const protocolId = cachedData.protocolId;

                // Find the protocol instance in portfolioHelper.strategy
                const protocolInstance = findProtocolByUniqueId(
                  protocolId,
                  portfolioHelper.strategy,
                );

                if (protocolInstance) {
                  cacheData.dust[chain][protocol] = {
                    assetBalance: ethers.BigNumber.from(
                      cachedData.assetBalance.hex,
                    ),
                    assetUsdBalanceOf: cachedData.assetUsdBalanceOf,
                    protocol: protocolInstance,
                  };
                }
              }
            });
          }
        });
      }
      // Reconstruct usdBalanceDict objects using protocolId
      if (cacheData.usdBalanceDict && portfolioHelper?.strategy) {
        Object.keys(cacheData.usdBalanceDict).forEach(
          (protocolIdWithClassName) => {
            const lastSlashIndex = protocolIdWithClassName.lastIndexOf("/");
            const protocolId = protocolIdWithClassName.substring(
              0,
              lastSlashIndex,
            );
            const cachedData =
              cacheData.usdBalanceDict[protocolIdWithClassName];

            // Find the protocol instance in portfolioHelper.strategy
            const protocolInstance = findProtocolByUniqueId(
              protocolId,
              portfolioHelper.strategy,
            );
            if (protocolInstance) {
              cacheData.usdBalanceDict[protocolIdWithClassName] = {
                ...cachedData,
                protocol: {
                  ...cachedData.protocol,
                  interface: protocolInstance,
                },
              };
            }
          },
        );
      }

      return cacheData;
    }

    return decompressedData;
  } catch (e) {
    console.error("Error retrieving from localStorage:", e);
    throw e;
  }
};

// Helper function to find protocol by uniqueId in strategy
const findProtocolByUniqueId = (targetId, strategy) => {
  for (const allocation of Object.values(strategy)) {
    for (const chainData of Object.values(allocation)) {
      for (const protocolData of chainData) {
        if (protocolData.interface.uniqueId() === targetId) {
          return protocolData.interface;
        }
      }
    }
  }
  return null;
};

export default function IndexOverviews() {
  const router = useRouter();
  const { portfolioName } = router.query;
  const account = useActiveAccount();
  const chainId = useActiveWalletChain();
  const switchChain = useSwitchActiveWalletChain();
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
  ];

  const getTokenMetadata = (chainId, tokenSymbol) => {
    if (!chainId) return null;

    const chainTokens =
      tokens.props.pageProps.tokenList[String(chainId?.id)] || [];
    if (!Array.isArray(chainTokens)) {
      return null;
    }

    const token = chainTokens.find(
      (token) => token.symbol?.toLowerCase() === tokenSymbol.toLowerCase(),
    );

    if (!token) {
      return null;
    }

    return `${token.symbol}-${token.value}-${token.decimals}`;
  };

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
  const [slippage, setSlippage] = useState(
    portfolioName?.includes("Stablecoin") ? 1 : 3,
  );
  const [zapOutPercentage, setZapOutPercentage] = useState(0);
  const [usdBalance, setUsdBalance] = useState(0);
  const [pendingRewards, setPendingRewards] = useState(0);
  const [rebalancableUsdBalanceDict, setrebalancableUsdBalanceDict] =
    useState(0);
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
    const gasPrice = await getGasPrice({
      client: THIRDWEB_CLIENT,
      chain: chainId,
    });
    const gasPriceInGwei = Number(gasPrice) / 1e9;
    if (gasPriceInGwei > 0.05) {
      openNotificationWithIcon(
        notificationAPI,
        "Gas Price Too High",
        "error",
        `Current gas price is ${gasPriceInGwei.toFixed(
          2,
        )} gwei, please try again later.`,
      );
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
    if (actionName === "zapIn") {
      setZapInIsLoading(true);
    } else if (actionName === "zapOut") {
      setZapOutIsLoading(true);
    } else if (actionName === "rebalance") {
      setRebalanceIsLoading(true);
    } else if (actionName === "transfer") {
      setTransferLoading(true);
    } else if (actionName === "stake") {
      setZapInIsLoading(true);
    } else if (actionName === "claimAndSwap") {
      // placeholder
    } else {
      throw new Error(`Invalid action name: ${actionName}`);
    }
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
        protocolAssetDustInWallet[
          chainId?.name?.toLowerCase()?.replace(" one", "")
        ],
        onlyThisChain,
      );
      setCostsCalculated(true);
      if (
        ["zapIn", "zapOut", "rebalance", "transfer"].includes(actionName) &&
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
        (1 - slippage / 100) *
        (1 - slippage / 100);
      const chainWeight = calCrossChainInvestmentAmount(
        chainId?.name?.toLowerCase().replace(" one", ""),
      );
      const chainWeightPerYourPortfolio =
        Object.values(rebalancableUsdBalanceDict)
          .filter(
            ({ chain }) =>
              chain === chainId?.name?.toLowerCase().replace(" one", ""),
          )
          .reduce((sum, value) => sum + value.usdBalance, 0) / usdBalance;
      // Call sendBatchTransaction and wait for the result
      try {
        await new Promise((resolve, reject) => {
          sendBatchTransaction(txns.flat(Infinity), {
            onSuccess: async (data) => {
              const explorerUrl =
                data?.chain?.blockExplorers !== undefined
                  ? data.chain.blockExplorers[0].url
                  : `https://explorer.${CHAIN_ID_TO_CHAIN_STRING[
                      chainId?.id
                    ].toLowerCase()}.io`;
              openNotificationWithIcon(
                notificationAPI,
                "Transaction Result",
                "success",
                `${explorerUrl}/tx/${data.transactionHash}`,
              );
              resolve(data); // Resolve the promise successfully
              try {
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
                    metadata: JSON.stringify({
                      portfolioName,
                      actionName,
                      tokenSymbol,
                      investmentAmount: investmentAmountAfterFee,
                      zapOutAmount:
                        actionName === "rebalance"
                          ? getRebalanceReinvestUsdAmount(currentChain?.name)
                          : usdBalance *
                            zapOutPercentage *
                            chainWeightPerYourPortfolio,
                      rebalanceAmount: getRebalanceReinvestUsdAmount(
                        currentChain?.name,
                      ),
                      timestamp: Math.floor(Date.now() / 1000),
                      swapFeeRate: portfolioHelper.swapFeeRate(),
                      referralFeeRate: portfolioHelper.referralFeeRate(),
                      chain:
                        CHAIN_ID_TO_CHAIN_STRING[chainId?.id].toLowerCase(),
                      zapInAmountOnThisChain: onlyThisChain
                        ? investmentAmountAfterFee
                        : investmentAmountAfterFee * chainWeight,
                      stakeAmountOnThisChain: Object.values(
                        protocolAssetDustInWallet?.[
                          chainId?.name?.toLowerCase()?.replace(" one", "")
                        ] || {},
                      ).reduce(
                        (sum, protocolObj) =>
                          sum + (Number(protocolObj.assetUsdBalanceOf) || 0),
                        0,
                      ),
                      transferTo: recipient,
                    }),
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
                        chain:
                          CHAIN_ID_TO_CHAIN_STRING[chainId?.id].toLowerCase(),
                        zapInAmountOnThisChain:
                          usdBalance *
                          zapOutPercentage *
                          chainWeightPerYourPortfolio,
                        sender: account.address,
                      }),
                    },
                  });
                }
              } catch (error) {
                console.error("category API error", error);
              }
              setFinishedTxn(true);
              // get current chain from Txn data
              const newNextChain = switchNextChain(data.chain.name);
              setNextStepChain(newNextChain);
              setChainStatus({ ...chainStatus, [currentChain]: true });
              setTxnLink(`${explorerUrl}/tx/${data.transactionHash}`);
            },
            onError: (error) => {
              reject(error); // Reject the promise with the error
            },
          });
        });
      } catch (error) {
        let errorReadableMsg;
        if (error.message.includes("0x495d907f")) {
          errorReadableMsg = "bridgequote expired, please try again";
        } else if (error.message.includes("0x203d82d8")) {
          errorReadableMsg = "DeFi pool quote has expired. Please try again.";
        } else if (error.message.includes("0x6f6dd725")) {
          errorReadableMsg = "Swap quote has expired. Please try again.";
        } else if (error.message.includes("0xf4059071")) {
          errorReadableMsg = "Please increase slippage tolerance";
        } else if (error.message.includes("User rejected the request")) {
          return;
        } else {
          errorReadableMsg =
            "Transaction failed. Please try increasing slippage tolerance or notify customer support to increase gas limit." +
            error.message;
        }
        openNotificationWithIcon(
          notificationAPI,
          "Transaction Result",
          "error",
          errorReadableMsg,
        );
      }
    } catch (error) {
      const errorMsg =
        error.name === "AxiosError"
          ? error.response?.data?.message
          : error.message;
      openNotificationWithIcon(
        notificationAPI,
        "Generate Transaction Error",
        "error",
        errorMsg,
      );
    }
    if (actionName === "zapIn") {
      setZapInIsLoading(false);
    } else if (actionName === "zapOut") {
      setZapOutIsLoading(false);
    } else if (actionName === "rebalance") {
      setRebalanceIsLoading(false);
    } else if (actionName === "stake") {
      setZapInIsLoading(false);
    } else if (actionName === "transfer") {
      setTransferLoading(false);
    }
  };

  const [nextStepChain, setNextStepChain] = useState("");
  const switchNextChain = (chain) => {
    const nextChain = chain.includes(" ")
      ? chain.toLowerCase().replace(" one", "")
      : chain;
    return nextChain === "arbitrum" ? "base" : "arbitrum";
  };

  const currentChain = chainId?.name?.toLowerCase().replace(" one", "").trim();
  // get all available chains
  const availableAssetChains = Object.entries(
    portfolioHelper?.strategy || {},
  ).flatMap(([category, protocols]) =>
    Object.entries(protocols).map(([chain, protocolArray]) => chain),
  );
  // get chain status
  const [chainStatus, setChainStatus] = useState({
    base: false,
    arbitrum: false,
  });
  // prepare chain object for switch chain
  const chainMap = {
    arbitrum: arbitrum,
    base: base,
  };

  const switchNextStepChain = (chain) => {
    const selectedChain = chainMap[chain];
    if (selectedChain) {
      switchChain(selectedChain);
    } else {
      console.error(`Invalid chain: ${chain}`);
    }
  };

  // calculate the total investment amount
  const allInvestmentAmount = useMemo(
    () =>
      preservedAmountRef.current *
      (1 - slippage / 100 - portfolioHelper?.swapFeeRate()),
    [preservedAmountRef.current, slippage, portfolioHelper],
  );
  // calculate the investment amount for next chain
  const calCrossChainInvestmentAmount = (nextChain) => {
    if (portfolioHelper?.strategy === undefined) return 0;
    return Object.entries(portfolioHelper.strategy).reduce(
      (sum, [category, protocols]) => {
        return (
          sum +
          Object.entries(protocols).reduce(
            (innerSum, [chain, protocolArray]) => {
              if (chain === nextChain) {
                return (
                  innerSum +
                  protocolArray.reduce((weightSum, protocol) => {
                    return weightSum + protocol.weight;
                  }, 0)
                );
              }
              return innerSum;
            },
            0,
          )
        );
      },
      0,
    );
  };
  const [nextChainInvestmentAmount, setNextChainInvestmentAmount] = useState(0);

  const onChange = (key) => {
    setTabKey(key);
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
              TOKEN_ADDRESS_MAP["weth"][
                chainId.name.toLowerCase().replace(" one", "")
              ],
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

  const getRebalanceReinvestUsdAmount = (chainFilter) => {
    const chain = chainFilter?.replace(" one", "").toLowerCase();
    if (chain === undefined) return 0;
    const filteredBalances = chain
      ? Object.values(rebalancableUsdBalanceDict).filter(
          (item) => item.chain === chain,
        )
      : Object.values(rebalancableUsdBalanceDict);
    const result =
      filteredBalances.reduce((sum, { usdBalance, zapOutPercentage }) => {
        return zapOutPercentage > 0 ? sum + usdBalance * zapOutPercentage : sum;
      }, 0) + portfolioHelper?.sumUsdDenominatedValues(pendingRewards);
    return result;
  };

  useEffect(() => {
    if (
      portfolioApr[portfolioName] === undefined ||
      Object.keys(portfolioApr).length === 0
    ) {
      dispatch(fetchStrategyMetadata());
    }
    if (portfolioName !== undefined) {
      const selectedTokenSymbol = selectedToken?.toLowerCase()?.split("-")[0];
      if (
        (selectedTokenSymbol === "eth" || selectedTokenSymbol === "weth") &&
        portfolioName === "Stablecoin Vault"
      ) {
        setSlippage(3);
      } else if (portfolioName === "ETH Vault") {
        setSlippage(3);
      } else {
        setSlippage(1);
      }
    }
  }, [portfolioName, selectedToken]);
  useEffect(() => {
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
        // If we have valid cached data that's less than 24 hours old
        if (
          cachedData &&
          cachedData.timestamp &&
          Date.now() - cachedData.timestamp < 86400 * 1000
        ) {
          // Use cached data
          setTokenPricesMappingTable(cachedData.tokenPricesMappingTable);
          setUsdBalance(cachedData.usdBalance);
          setrebalancableUsdBalanceDict(cachedData.usdBalanceDict);
          setLockUpPeriod(cachedData.lockUpPeriod);
          setPendingRewards(cachedData.pendingRewards);
          setProtocolAssetDustInWallet(cachedData.dust);

          // Reset loading states
          setUsdBalanceLoading(false);
          setPendingRewardsLoading(false);
          setrebalancableUsdBalanceDictLoading(false);
          setProtocolAssetDustInWalletLoading(false);
          return; // Exit early - don't make API calls
        }
        // If we reach here, either there's no cache or it's stale
        // Fetch fresh data
        const tokenPricesMappingTable =
          await portfolioHelper.getTokenPricesMappingTable();
        let [usdBalance, usdBalanceDict] = await portfolioHelper.usdBalanceOf(
          account.address,
          portfolioApr[portfolioName],
        );
        const portfolioLockUpPeriod = await portfolioHelper.lockUpPeriod(
          account.address,
        );
        const pendingRewards = await portfolioHelper.pendingRewards(
          account.address,
          () => {},
        );

        const dust =
          await portfolioHelper.calProtocolAssetDustInWalletDictionary(
            account.address,
            tokenPricesMappingTable,
          );
        const dustTotalUsdBalance = Object.values(dust).reduce(
          (sum, protocolObj) => {
            return (
              sum +
              Object.values(protocolObj).reduce((protocolSum, asset) => {
                return protocolSum + (Number(asset.assetUsdBalanceOf) || 0);
              }, 0)
            );
          },
          0,
        );
        usdBalance += dustTotalUsdBalance;

        // Cache the fresh data
        const newCacheData = {
          tokenPricesMappingTable,
          usdBalance,
          usdBalanceDict,
          lockUpPeriod: portfolioLockUpPeriod,
          pendingRewards: pendingRewards.pendingRewardsDict,
          dust,
          timestamp: Date.now(),
        };
        try {
          safeSetLocalStorage(
            `portfolio-${portfolioName}-${account.address}`,
            newCacheData,
          );
        } catch (error) {
          console.warn("Failed to cache portfolio data:", error);
        }

        // Update state with fresh data
        setTokenPricesMappingTable(tokenPricesMappingTable);
        setUsdBalance(usdBalance);
        setrebalancableUsdBalanceDict(usdBalanceDict);
        setLockUpPeriod(portfolioLockUpPeriod);
        setPendingRewards(pendingRewards.pendingRewardsDict);
        setProtocolAssetDustInWallet(dust);
      } catch (error) {
        console.error("Error in fetchUsdBalance:", error);
      } finally {
        // Reset loading and processing states
        setUsdBalanceLoading(false);
        setPendingRewardsLoading(false);
        setrebalancableUsdBalanceDictLoading(false);
        setProtocolAssetDustInWalletLoading(false);
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
        const metadata = getTokenMetadata(chainId, tokenSymbol);
        if (metadata) return { metadata, tokenSymbol };
      }
      return {
        metadata: getTokenMetadata(chainId, "usdc"),
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
    availableAssetChains,
    chainStatus,
    onRefresh: handleRefresh,
  };

  const items = useTabItems(tabProps);
  return (
    <BasePage>
      {notificationContextHolder}
      <PopUpModal
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
        rebalanceAmount={getRebalanceReinvestUsdAmount(chainId?.name)}
        zapOutAmount={usdBalance * zapOutPercentage}
      />
      <main className={styles.bgStyle}>
        <header className="relative isolate pt-6">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <div className="sm:flex items-center justify-between gap-x-6">
              <div className="flex items-center">
                <img
                  alt=""
                  src={`/indexFunds/${portfolioName?.toLowerCase()}.webp`}
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
                        {[1, 3, 5, 7].map((slippageValue) => (
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
                            ? `/chainPicturesWebp/${chainId.name
                                .toLowerCase()
                                .replace(" one", "")}.webp`
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
