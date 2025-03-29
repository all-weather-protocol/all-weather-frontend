"use client";

import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import Image from "next/image";
import DemoFlowDirectionGraph from "../FlowChart";
import { QuestionMarkCircleIcon } from "@heroicons/react/20/solid";
import { Popover, Spin } from "antd";
import ActionItem from "../../components/common/ActionItem";
import EmailSubscription from "../emailsubscription";

const formatAmount = (amount) => {
  if (amount === undefined || amount === null) return <Spin />;
  const absAmount = Math.abs(amount);
  return absAmount < 0.01 ? "< $0.01" : `$${absAmount.toFixed(2)}`;
};

const calculatePerformanceFee = (portfolioHelper, portfolioAPR) => {
  const rebalanceMultiplier =
    portfolioHelper?.constructor?.name === "EthVault" ? 0 : 4;
  return (
    ((rebalanceMultiplier * 0.00299 * 2 * 0.5 + 0.00299 * 2) / portfolioAPR) *
    100
  ).toFixed(2);
};

const AmountDisplay = ({
  propKey,
  amount,
  showEmoji = false,
  isGreen = false,
  isLoading = false,
  showOnlyPercentage = false,
  portfolioHelper,
  portfolioAPR,
}) => {
  const className = isGreen ? "text-green-500" : "";

  if (isLoading) {
    return <Spin key={`spin-${amount}`} />;
  }

  if (showOnlyPercentage) {
    return (
      <span className={className} key={propKey}>
        {`${calculatePerformanceFee(portfolioHelper, portfolioAPR)}%`}
      </span>
    );
  }

  return (
    <span className={className} key={propKey}>
      {showEmoji && "🎉 Earned "}
      {formatAmount(amount)}
    </span>
  );
};

export default function PopUpModal({
  account,
  portfolioHelper,
  stepName,
  tradingLoss,
  totalTradingLoss,
  open,
  setOpen,
  chainId,
  finishedTxn,
  txnLink,
  portfolioAPR,
  actionName,
  selectedToken,
  investmentAmount,
  costsCalculated,
  platformFee,
  rebalancableUsdBalanceDict,
  chainMetadata,
  rebalanceAmount,
  zapOutAmount,
  availableAssetChains,
  currentChain,
  chainStatus,
  currentTab,
  allChainsComplete,
}) {
  const renderStatusIcon = () => (!finishedTxn ? <Spin /> : null);

  const getStatusMessage = () =>
    !finishedTxn ? "Bundling transactions..." : "";

  const getCurrentStep = () => {
    const completedSteps = Object.values(chainStatus || {}).filter(
      Boolean,
    ).length;
    return completedSteps + 1;
  };

  const getNextChain = () => {
    const nextChain = Object.entries(chainStatus || {}).find(
      ([chain, isComplete]) => !isComplete,
    )?.[0];
    return {
      name: nextChain,
      imagePath: `/chainPicturesWebp/${nextChain?.toLowerCase()}.webp`,
    };
  };

  return (
    <Dialog
      open={Boolean(open)} // Ensure boolean conversion
      onClose={() => {
        setOpen(false);
      }}
      className="relative z-10"
    >
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-gray-500/95 transition-opacity data-[closed]:opacity-0 data-[enter]:duration-300 data-[leave]:duration-200 data-[enter]:ease-out data-[leave]:ease-in"
      />
      <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
        <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          <DialogPanel
            transition
            className="relative transform overflow-hidden rounded-lg bg-gray-300 px-4 pb-4 pt-5 text-left shadow-xl transition-all data-[closed]:translate-y-4 data-[closed]:opacity-0 data-[enter]:duration-300 data-[leave]:duration-200 data-[enter]:ease-out data-[leave]:ease-in sm:my-8 sm:w-full sm:max-w-5xl sm:p-6 data-[closed]:sm:translate-y-0 data-[closed]:sm:scale-95"
          >
            <div className="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                <span className="sr-only">Close</span>
                <XMarkIcon aria-hidden="true" className="size-6" />
              </button>
            </div>
            <div className="flex flex-col h-full">
              <div>
                <div className="text-center mt-5">
                  <ActionItem
                    actionName={
                      currentTab === "4"
                        ? rebalancableUsdBalanceDict?.metadata?.rebalanceActionsByChain.map(
                            (action) => action.actionName,
                          )
                        : actionName
                    }
                    availableAssetChains={
                      currentTab === "4"
                        ? rebalancableUsdBalanceDict?.metadata?.rebalanceActionsByChain.map(
                            (action) => action.chain,
                          )
                        : availableAssetChains
                    }
                    currentChain={currentChain}
                    chainStatus={chainStatus}
                    theme="light"
                    isStarted={Object.values(chainStatus || {}).some(
                      (status) => status,
                    )}
                  />
                </div>
                <div className="mx-auto flex items-center justify-center rounded-full">
                  {renderStatusIcon()}
                  <DialogTitle as="h3" className="ms-2 text-base text-gray-900">
                    {getStatusMessage()}
                  </DialogTitle>
                </div>
              </div>
              <div className="flex-grow">
                {finishedTxn === false && actionName !== "" ? (
                  <DemoFlowDirectionGraph
                    data={portfolioHelper?.getFlowChartData(actionName, {
                      tokenInSymbol:
                        selectedToken?.toLowerCase()?.split("-")[0] === "eth"
                          ? "weth"
                          : selectedToken?.toLowerCase()?.split("-")[0],
                      tokenInAddress: selectedToken
                        ?.toLowerCase()
                        ?.split("-")[1],
                      outputToken: selectedToken?.toLowerCase()?.split("-")[0],
                      outputTokenAddress: selectedToken
                        ?.toLowerCase()
                        ?.split("-")[1],
                      rebalancableUsdBalanceDict,
                      chainMetadata,
                    })}
                    stepName={stepName}
                    tradingLoss={tradingLoss}
                    currentChain={chainId?.name}
                  />
                ) : (
                  <>
                    <div className="flex flex-col items-center gap-4 w-full mt-4">
                      {allChainsComplete === true ? (
                        <>
                          <EmailSubscription />
                          <a
                            href={`https://debank.com/profile/${account?.address}`}
                            target="_blank"
                            className="w-full max-w-md flex items-center justify-center gap-3 px-4 py-3.5 rounded-xl bg-white/25 shadow-md hover:bg-white/25 transition-colors text-gray-200 border border-gray-100/50"
                          >
                            <Image
                              src="/projectPictures/debank.webp"
                              alt="debank"
                              height={25}
                              width={25}
                            />
                            <span className="text-gray-400 font-medium">
                              Check your portfolio on Debank
                            </span>
                          </a>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setOpen(false)}
                          className="w-full max-w-md flex items-center justify-center gap-3 px-4 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 transition-colors text-white shadow-md"
                        >
                          Step {getCurrentStep()}: {actionName} on
                          <Image
                            src={getNextChain().imagePath}
                            alt={getNextChain().name}
                            width={25}
                            height={25}
                          />
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
              {/* Cost summary */}
              <dl className="mt-6 space-y-4">
                <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                  <dt className="flex items-center text-sm text-gray-600">
                    <span>
                      {totalTradingLoss > 0
                        ? "Arbitrage profit estimate"
                        : "Transaction cost estimate"}
                    </span>
                    <a
                      href="#"
                      className="ml-2 shrink-0 text-gray-400 hover:text-gray-500"
                    >
                      <Popover
                        content={
                          <>
                            Transaction cost estimate:
                            <br />
                            1. DEX slippage
                            <br />
                            2. Deposit fee charged by protocols like Pendle,
                            Curve, etc.
                            <br />
                            3. Withdrawal fee charged by protocols like Pendle,
                            Curve, etc.
                            <br />
                            <br />
                            Arbitrage profit estimate:
                            <br />
                            1. Market inefficiencies between protocols may
                            create opportunities for profitable trades
                            <br />
                          </>
                        }
                        title="How is this calculated?"
                        trigger="hover"
                      >
                        <QuestionMarkCircleIcon
                          aria-hidden="true"
                          className="size-5"
                        />
                      </Popover>
                    </a>
                  </dt>
                  <dd className="text-sm font-medium text-gray-900">
                    <AmountDisplay
                      propKey="tansaction-costs"
                      amount={totalTradingLoss}
                      showEmoji={totalTradingLoss > 0 && costsCalculated}
                      isGreen={totalTradingLoss > 0}
                      isLoading={!costsCalculated}
                      portfolioHelper={portfolioHelper}
                      portfolioAPR={portfolioAPR}
                    />
                  </dd>
                </div>
                <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                  <dt className="flex items-center text-sm text-gray-600">
                    <span>Platform fee estimate</span>
                    <a
                      href="#"
                      className="ml-2 shrink-0 text-gray-400 hover:text-gray-500"
                    >
                      <Popover
                        content={
                          <>
                            1. Zap in: 0.299%
                            <br />
                            2. Zap out: 0.299%
                            <br />
                            3. Rebalance: 0.598%
                            <br />
                            <br />
                            (zap-in * 1 time + zap-out * 1 time + rebalance *
                            {portfolioHelper?.constructor?.name === "EthVault"
                              ? 0
                              : 4}
                            {""}
                            times per year * 50%) / APR = <br />
                            (usually of 50% of your money needs to be
                            rebalanced) <br />
                            (0.00299 * 1 + 0.00299 * 1 + 0.00598 *{" "}
                            {portfolioHelper?.constructor?.name === "EthVault"
                              ? 0
                              : 4}{" "}
                            * 0.5) / {portfolioAPR} = <br />
                            {(
                              ((0.00299 * 1 +
                                0.00299 * 1 +
                                0.00598 *
                                  (portfolioHelper?.constructor?.name ===
                                  "EthVault"
                                    ? 0
                                    : 4) *
                                  0.5) /
                                portfolioAPR) *
                              100
                            ).toFixed(2)}
                            %
                          </>
                        }
                        title="How is Maximum Performance fee calculated?"
                        trigger="hover"
                      >
                        <QuestionMarkCircleIcon
                          aria-hidden="true"
                          className="size-5"
                        />
                      </Popover>
                    </a>
                  </dt>
                  <dd className="text-sm font-medium text-gray-900">
                    Maximum Performance fee{" "}
                    <AmountDisplay
                      propKey="platformFee"
                      amount={platformFee}
                      showEmoji={false}
                      isGreen={false}
                      isLoading={!costsCalculated}
                      showOnlyPercentage={true}
                      portfolioHelper={portfolioHelper}
                      portfolioAPR={portfolioAPR}
                    />
                  </dd>
                </div>
              </dl>
            </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}
