import React from "react";
import { CheckCircleIcon } from "@heroicons/react/24/outline";

const actionNameMap = {
  zapIn: "Deposit",
  zapOut: "Withdraw",
  crossChainRebalance: "Cross-Chain Rebalance",
  localRebalance: "Rebalance",
};

const ActionItem = ({
  actionName,
  availableAssetChains,
  currentChain,
  chainStatus,
  theme,
  isStarted,
}) => {
  const actionIsArray = Array.isArray(actionName);

  const sortedChains = React.useMemo(() => {
    if (!availableAssetChains) return [];
    if (!isStarted) {
      return [...availableAssetChains].sort((a, b) => {
        if (a === currentChain) return -1;
        if (b === currentChain) return 1;
        return 0;
      });
    }
    return availableAssetChains;
  }, [availableAssetChains, currentChain, isStarted]);

  const getChainStatusStyles = (chain) => {
    const isActive = chainStatus[chain];
    const isCurrentChain = currentChain === chain;
    const isDarkTheme = theme === "dark";

    return {
      text: isActive
        ? "text-green-500"
        : isCurrentChain
        ? isDarkTheme
          ? "text-white"
          : "text-gray-900"
        : "text-gray-500",
      border: isActive
        ? "border-green-500"
        : isCurrentChain
        ? isDarkTheme
          ? "border-white"
          : "border-gray-900"
        : "border-gray-500",
    };
  };

  const renderChainIndicator = (chain, index) => {
    const styles = getChainStatusStyles(chain);
    const showPulsingDot = chain === currentChain && !chainStatus[chain];
    const actionText = actionIsArray
      ? actionNameMap[actionName[index]]
      : actionNameMap[actionName];

    return (
      <div
        className={`flex flex-col items-center mx-2 ${styles.text}`}
        key={index}
      >
        <div
          className={`w-10 h-10 border-2 rounded-full flex items-center justify-center relative ${styles.border}`}
        >
          {showPulsingDot && (
            <div className="absolute -top-2">
              <span className="relative flex size-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex size-3 rounded-full bg-red-500"></span>
              </span>
            </div>
          )}
          {index + 1}
        </div>
        <p>
          {actionText} on {chain}
        </p>
      </div>
    );
  };

  const renderCompletionStatus = () => {
    if (!availableAssetChains?.length) {
      return (
        <div className="text-gray-500 text-center mb-2">
          <p>No actions available at this time.</p>
        </div>
      );
    }

    const allActionsCompleted = availableAssetChains.every(
      (chain) => chainStatus[chain],
    );
    if (allActionsCompleted) {
      return (
        <div className="text-green-500 text-center mb-2">
          <CheckCircleIcon className="w-12 h-12 mx-auto" />
          <p>You have completed all actions.</p>
        </div>
      );
    }

    return null;
  };

  return (
    <>
      <div className="flex justify-center text-base font-semibold">
        {sortedChains?.map(renderChainIndicator)}
      </div>
      <div className="mt-4">{renderCompletionStatus()}</div>
    </>
  );
};

export default ActionItem;
export { actionNameMap };
