"use client";
import BasePage from "../basePage.tsx";
import { useState, useCallback, useMemo, useEffect } from "react";
import DecimalStep from "./DecimalStep";
import { QuestionMarkCircleIcon } from "@heroicons/react/20/solid";
import { ShieldCheckIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/router";
import { Button, Progress } from "antd";
import TokenDropdownInput from "../views/TokenDropdownInput.jsx";
import { useActiveAccount, useSendBatchTransaction } from "thirdweb/react";
import { getPortfolioHelper } from "../../utils/thirdwebSmartWallet.ts";
import {
  getLocalizedCurrencyAndExchangeRate,
  formatBalanceWithLocalizedCurrency,
} from "../../utils/general";
import APRComposition from "../views/components/APRComposition";
export default function IndexOverviews() {
  const router = useRouter();
  const { portfolioName } = router.query;
  const product = {
    description: "A diversified stablecoin vault",
    imageSrc: "/indexFunds/allWeatherPortfolio.png",
    imageAlt:
      "Model wearing light green backpack with black canvas straps and front zipper pouch.",
    breadcrumbs: [
      { id: 1, name: "Indexes", href: "#" },
      { id: 2, name: portfolioName, href: "#" },
    ],
  };

  const account = useActiveAccount();
  const [selectedToken, setSelectedToken] = useState(
    "USDC-0xaf88d065e77c8cc2239327c5edb3a432268e5831",
  );
  const [investmentAmount, setInvestmentAmount] = useState(0);
  const [zapInIsLoading, setZapInIsLoading] = useState(false);
  const [zapOutIsLoading, setZapOutIsLoading] = useState(false);
  const [claimIsLoading, setClaimIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stepName, setStepName] = useState("");
  const [slippage, setSlippage] = useState(1);
  const [zapOutPercentage, setZapOutPercentage] = useState(1);
  const [sliderValue, setSliderValue] = useState(100);
  const [portfolioApr, setPortfolioAPR] = useState(20);
  const [usdBalance, setUsdBalance] = useState(0);
  const [pendingRewards, setPendingRewards] = useState(0);
  const [currency, setCurrency] = useState("USD");
  const [exchangeRateWithUSD, setExchangeRateWithUSD] = useState(1);
  const [usdBalanceLoading, setUsdBalanceLoading] = useState(false);
  const [pendingRewardsLoading, setPendingRewardsLoading] = useState(false);

  const handleSetSelectedToken = useCallback((token) => {
    setSelectedToken(token);
  }, []);
  const handleSetInvestmentAmount = useCallback((amount) => {
    setInvestmentAmount(amount);
  }, []);
  const portfolioHelper = useMemo(
    () => getPortfolioHelper(portfolioName?.replace(" ", "")),
    [portfolioName],
  );

  const { mutate: sendBatchTransaction } = useSendBatchTransaction();
  const handleAAWalletAction = async (actionName) => {
    const tokenSymbolAndAddress = selectedToken.toLowerCase();
    if (!tokenSymbolAndAddress) {
      alert("Please select a token");
      return;
    }
    if (actionName === "zapIn") {
      setZapInIsLoading(true);
    } else if (actionName === "zapOut") {
      setZapOutIsLoading(true);
    } else if (actionName === "claimAndSwap") {
      setClaimIsLoading(true);
    }
    if (!account) return;
    const [tokenSymbol, tokenAddress] = tokenSymbolAndAddress.split("-");
    let txns;
    if (actionName === "zapIn") {
      txns = await portfolioHelper.portfolioAction("zapIn", {
        account,
        tokenInSymbol: tokenSymbol,
        tokenInAddress: tokenAddress,
        zapInAmount: Number(investmentAmount),
        progressCallback: (progressPercentage) =>
          setProgress(progressPercentage),
        progressStepNameCallback: (stepName) => setStepName(stepName),
        slippage,
      });
    } else if (actionName === "zapOut") {
      txns = await portfolioHelper.portfolioAction("zapOut", {
        account,
        tokenOutSymbol: tokenSymbol,
        tokenOutAddress: tokenAddress,
        zapOutPercentage: Number(zapOutPercentage),
        progressCallback: (progressPercentage) =>
          setProgress(progressPercentage),
        progressStepNameCallback: (stepName) => setStepName(stepName),
        slippage,
      });
    } else if (actionName === "claimAndSwap") {
      txns = await portfolioHelper.portfolioAction(actionName, {
        account,
        tokenOutAddress: tokenAddress,
        progressCallback: (progressPercentage) =>
          setProgress(progressPercentage),
        progressStepNameCallback: (stepName) => setStepName(stepName),
        slippage,
      });
    }
    if (actionName === "zapIn") {
      setZapInIsLoading(false);
    } else if (actionName === "zapOut") {
      setZapOutIsLoading(false);
    } else if (actionName === "claimAndSwap") {
      setClaimIsLoading(false);
    }
    // Call sendBatchTransaction and wait for the result
    const result = await new Promise((resolve, reject) => {
      sendBatchTransaction(txns.flat(Infinity), {
        onSuccess: (data) => resolve(data),
        onError: (error) => reject(error),
      });
    });

    // Handle the successful result
    console.log("Transaction successful:", result);
  };
  // Function to sum up the usdDenominatedValue
  function sumUsdDenominatedValues(mapping) {
    return Object.values(mapping).reduce((total, entry) => {
      return total + (entry.usdDenominatedValue || 0);
    }, 0);
  }
  useEffect(() => {
    if (!portfolioName || account === undefined) return;
    const fetchPortfolioAPR = async () => {
      const apr = await portfolioHelper.getPortfolioAPR();
      setPortfolioAPR((apr.portfolioAPR * 100).toFixed(2));
    };
    fetchPortfolioAPR();
  }, [portfolioName, account]);
  useEffect(() => {
    if (!portfolioName || account === undefined) return;
    const fetchUsdBalance = async () => {
      setUsdBalanceLoading(true);
      const usdBalance = await portfolioHelper.usdBalanceOf(account.address);
      setUsdBalance(usdBalance);
      const pendingRewards = await portfolioHelper.pendingRewards(
        account.address,
        (progressPercentage) => setProgress(progressPercentage),
      );
      setPendingRewards(pendingRewards);
      setUsdBalanceLoading(false);
    };
    fetchUsdBalance();
  }, [portfolioName, account]);
  useEffect(() => {
    if (!portfolioName || account === undefined) return;
    const fetchExchangeRateWithUSD = async () => {
      setPendingRewardsLoading(true);
      const { currency, exchangeRateWithUSD } =
        await getLocalizedCurrencyAndExchangeRate();
      setCurrency(currency);
      setExchangeRateWithUSD(exchangeRateWithUSD);
      setPendingRewardsLoading(false);
    };
    fetchExchangeRateWithUSD();
  }, [portfolioName, account]);

  return (
    <BasePage>
      <div className="bg-white">
        <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24 lg:grid lg:max-w-7xl lg:grid-cols-2 lg:gap-x-8 lg:px-8">
          {/* Product details */}
          <div className="lg:max-w-lg lg:self-end">
            <nav aria-label="Breadcrumb">
              <ol role="list" className="flex items-center space-x-2">
                {product.breadcrumbs.map((breadcrumb, breadcrumbIdx) => (
                  <li key={breadcrumb.id}>
                    <div className="flex items-center text-sm">
                      <a
                        href={breadcrumb.href}
                        className="font-medium text-gray-500 hover:text-gray-900"
                      >
                        {breadcrumb.name}
                      </a>
                      {breadcrumbIdx !== product.breadcrumbs.length - 1 ? (
                        <svg
                          fill="currentColor"
                          viewBox="0 0 20 20"
                          aria-hidden="true"
                          className="ml-2 h-5 w-5 flex-shrink-0 text-gray-300"
                        >
                          <path d="M5.555 17.776l8-16 .894.448-8 16-.894-.448z" />
                        </svg>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            </nav>

            <div className="mt-4">
              <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                {portfolioName}
              </h1>
            </div>

            <section aria-labelledby="information-heading" className="mt-4">
              <h2 id="information-heading" className="sr-only">
                Product information
              </h2>

              <div className="flex items-center">
                <p className="text-lg text-gray-900 sm:text-xl">
                  APR: {portfolioApr}%
                </p>
                <a
                  href="#"
                  className="group inline-flex text-sm text-gray-500 hover:text-gray-700"
                >
                  <QuestionMarkCircleIcon
                    aria-hidden="true"
                    className="ml-2 h-5 w-5 flex-shrink-0 text-gray-400 group-hover:text-gray-500"
                  />
                </a>

                <div className="ml-4 border-l border-gray-300 pl-4">
                  <div className="flex items-center">
                    <p className="ml-2 text-sm text-gray-500">TVL: upcoming</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-6">
                <p className="text-base text-gray-500">{product.description}</p>
              </div>
            </section>
          </div>

          {/* Product image */}
          <div className="mt-10 lg:col-start-2 lg:row-span-2 lg:mt-0 lg:self-center">
            <div className="aspect-h-1 aspect-w-1 overflow-hidden rounded-lg">
              <img
                alt={product.imageAlt}
                src={product.imageSrc}
                className="h-full w-full object-cover object-center"
              />
            </div>
          </div>

          {/* Product form */}
          <div className="mt-10 lg:col-start-1 lg:row-start-2 lg:max-w-lg lg:self-start">
            <section aria-labelledby="options-heading">
              <h2 id="options-heading" className="sr-only">
                Product options
              </h2>

              <form>
                <div className="sm:flex sm:justify-between">
                  {/* Size selector */}
                  <fieldset>
                    <TokenDropdownInput
                      selectedToken={selectedToken}
                      setSelectedToken={handleSetSelectedToken}
                      investmentAmount={investmentAmount}
                      setInvestmentAmount={handleSetInvestmentAmount}
                    />
                  </fieldset>
                </div>
                <div className="mt-10">
                  <Button
                    className="flex w-full items-center justify-center rounded-md border border-transparent bg-indigo-600 px-8 py-3 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-50"
                    onClick={() => handleAAWalletAction("zapIn")}
                    loading={zapInIsLoading}
                  >
                    Zap In
                  </Button>
                </div>
                <div className="mt-10">
                  <DecimalStep
                    setZapOutPercentage={setZapOutPercentage}
                    sliderValue={sliderValue}
                    setSliderValue={setSliderValue}
                  />
                  <Button
                    className="flex w-full items-center justify-center rounded-md border border-transparent bg-indigo-600 px-8 py-3 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-50"
                    onClick={() => handleAAWalletAction("zapOut")}
                    loading={zapOutIsLoading || usdBalanceLoading}
                    disabled={usdBalance === 0}
                  >
                    Zap Out{" "}
                    {formatBalanceWithLocalizedCurrency(
                      exchangeRateWithUSD,
                      usdBalance * zapOutPercentage,
                      currency,
                    )}
                  </Button>
                </div>
                <div className="mt-10">
                  <Button
                    className="flex w-full items-center justify-center rounded-md border border-transparent bg-indigo-600 px-8 py-3 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-50"
                    onClick={() => handleAAWalletAction("claimAndSwap")}
                    loading={claimIsLoading || pendingRewardsLoading}
                    disabled={sumUsdDenominatedValues(pendingRewards) === 0}
                  >
                    Claim{" "}
                    {formatBalanceWithLocalizedCurrency(
                      exchangeRateWithUSD,
                      sumUsdDenominatedValues(pendingRewards),
                      currency,
                    )}
                  </Button>
                  <APRComposition
                    APRData={pendingRewards}
                    mode="pendingRewards"
                    currency={currency}
                    exchangeRateWithUSD={exchangeRateWithUSD}
                  />
                </div>
                {zapInIsLoading || zapOutIsLoading || claimIsLoading ? (
                  <Progress
                    percent={progress.toFixed(2)}
                    status={
                      zapInIsLoading || zapOutIsLoading || claimIsLoading
                        ? "active"
                        : ""
                    }
                    size={[400, 10]}
                    showInfo={true}
                    format={(percent) => `${percent}% ${stepName}`}
                  />
                ) : null}
                <div className="mt-6 text-center">
                  <a
                    href="https://all-weather.gitbook.io/all-weather-protocol/contracts-and-security/audits"
                    className="group inline-flex text-base font-medium"
                  >
                    <ShieldCheckIcon
                      aria-hidden="true"
                      className="mr-2 h-6 w-6 flex-shrink-0 text-gray-400 group-hover:text-gray-500"
                    />
                    <span className="text-gray-500 hover:text-gray-700">
                      Audited
                    </span>
                  </a>
                </div>
              </form>
            </section>
          </div>
        </div>
      </div>
    </BasePage>
  );
}
