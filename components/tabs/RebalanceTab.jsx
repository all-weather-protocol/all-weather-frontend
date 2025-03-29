import { Button, Spin } from "antd";
import { useState } from "react";
import ActionItem from "../common/ActionItem";
import TokenDropdownInput from "../../pages/views/TokenDropdownInput.jsx";
import { actionNameMap } from "../common/ActionItem";
import { formatLockUpPeriod } from "../../utils/general";
// Add sleep utility function
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function RebalanceTab({
  rebalancableUsdBalanceDictLoading,
  rebalancableUsdBalanceDict,
  chainId,
  handleAAWalletAction,
  rebalanceIsLoading,
  getRebalanceReinvestUsdAmount,
  usdBalance,
  portfolioHelper,
  portfolioApr,
  portfolioName,
  switchChain,
  CHAIN_ID_TO_CHAIN,
  CHAIN_TO_CHAIN_ID,
  chainStatus,
  selectedToken,
  handleSetSelectedToken,
  handleSetInvestmentAmount,
  investmentAmount,
  tokenPricesMappingTable,
  lockUpPeriod,
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const calCurrentAPR = (rebalancableUsdBalanceDict) =>
    Object.entries(rebalancableUsdBalanceDict)
      .filter(([key]) => !["pendingRewards", "metadata"].includes(key))
      .reduce(
        (sum, [_, { currentWeight, APR }]) => currentWeight * APR + sum,
        0,
      ) || 0;
  const currentChain = chainId?.name
    ?.toLowerCase()
    .replace(" one", "")
    .replace(" mainnet", "")
    .trim();
  return (
    <div>
      {rebalancableUsdBalanceDictLoading ? <Spin /> : null}
      <ActionItem
        actionName={rebalancableUsdBalanceDict?.metadata?.rebalanceActionsByChain.map(
          (action) => action.actionName,
        )}
        availableAssetChains={rebalancableUsdBalanceDict?.metadata?.rebalanceActionsByChain.map(
          (action) => action.chain,
        )}
        currentChain={currentChain}
        chainStatus={chainStatus}
        theme="dark"
        isStarted={Object.values(chainStatus || {}).some((status) => status)}
      />
      {rebalancableUsdBalanceDict?.metadata?.rebalanceActionsByChain.every(
        (action) => chainStatus[action.chain],
      )
        ? null
        : rebalancableUsdBalanceDict?.metadata?.rebalanceActionsByChain?.map(
            (data, index) => {
              // Normalize chain names for comparison
              const currentChainName = chainId?.name?.toLowerCase().trim();
              const targetChainName = data.chain.toLowerCase().trim();
              const isCurrentChain =
                currentChainName.includes(targetChainName) ||
                targetChainName.includes(currentChainName);
              // Only show the current step
              if (index !== currentStep) {
                return null;
              }
              return (
                <div key={`${data.chain}-${data.actionName}`} className="mb-4">
                  {data.actionName === "localRebalance" && (
                    <TokenDropdownInput
                      selectedToken={selectedToken}
                      setSelectedToken={handleSetSelectedToken}
                      setInvestmentAmount={handleSetInvestmentAmount}
                      tokenPricesMappingTable={tokenPricesMappingTable}
                    />
                  )}
                  {isCurrentChain ? (
                    <Button
                      type="primary"
                      className="w-full"
                      onClick={async () => {
                        handleAAWalletAction(data.actionName, true);
                        // Only increment step if there are more actions
                        await sleep(3000);
                        if (
                          currentStep <
                          rebalancableUsdBalanceDict.metadata
                            .rebalanceActionsByChain.length -
                            1
                        ) {
                          setCurrentStep(currentStep + 1);
                        }
                      }}
                      loading={rebalancableUsdBalanceDictLoading}
                      disabled={
                        usdBalance <= 0 ||
                        (data.actionName === "localRebalance" &&
                          Number(investmentAmount) === 0) ||
                        lockUpPeriod > 0
                      }
                    >
                      {lockUpPeriod > 0
                        ? `Rebalance (unlocks in ${formatLockUpPeriod(
                            lockUpPeriod,
                          )})`
                        : actionNameMap[data.actionName]}{" "}
                      on {data.chain}
                    </Button>
                  ) : (
                    <Button
                      type="primary"
                      className="w-full"
                      onClick={() =>
                        switchChain(
                          CHAIN_ID_TO_CHAIN[CHAIN_TO_CHAIN_ID[data.chain]],
                        )
                      }
                      disabled={lockUpPeriod > 0}
                    >
                      {lockUpPeriod > 0
                        ? `Switch to ${
                            data.chain
                          } Chain (unlocks in ${formatLockUpPeriod(
                            lockUpPeriod,
                          )})`
                        : `Switch to ${data.chain} Chain`}
                    </Button>
                  )}
                </div>
              );
            },
          )}

      <div className="mt-4 text-gray-400">
        <p>Expected APR after rebalance: </p>
        <div className="flex items-center gap-2">
          <span className="text-red-500">
            {rebalancableUsdBalanceDictLoading ? (
              <Spin />
            ) : (
              calCurrentAPR(rebalancableUsdBalanceDict).toFixed(2)
            )}
          </span>
          <span>→</span>
          <span className="text-green-400">
            {portfolioApr[portfolioName]?.portfolioAPR ? (
              (portfolioApr[portfolioName]?.portfolioAPR * 100).toFixed(2)
            ) : (
              <Spin />
            )}
            %
          </span>
        </div>
      </div>
    </div>
  );
}
