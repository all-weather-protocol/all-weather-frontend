import { Button } from "antd";
import DecimalStep from "../../pages/indexes/DecimalStep";
import ConfiguredConnectButton from "../../pages/ConnectButton";
import { formatLockUpPeriod } from "../../utils/general";
import ActionItem from "../common/ActionItem";

export default function ZapOutTab({
  selectedToken,
  handleSetSelectedToken,
  usdBalance,
  setZapOutPercentage,
  account,
  handleAAWalletAction,
  zapOutIsLoading,
  zapOutPercentage,
  usdBalanceLoading,
  portfolioHelper,
  pendingRewards,
  chainId,
  availableAssetChains,
  chainStatus,
  switchChain,
  CHAIN_ID_TO_CHAIN,
  CHAIN_TO_CHAIN_ID,
  lockUpPeriod,
}) {
  const currentChain = chainId?.name
    ?.toLowerCase()
    .replace(" one", "")
    .replace(" mainnet", "")
    .trim();
  return (
    <div>
      <ActionItem
        actionName="zapOut"
        availableAssetChains={availableAssetChains}
        currentChain={currentChain}
        chainStatus={chainStatus}
        theme="dark"
        isStarted={Object.values(chainStatus || {}).some((status) => status)}
      />
      {Object.values(chainStatus).some((status) => status) ? null : (
        <DecimalStep
          selectedToken={selectedToken}
          setSelectedToken={handleSetSelectedToken}
          depositBalance={usdBalance}
          setZapOutPercentage={setZapOutPercentage}
          currency="$"
          noTokenSelect={false}
          zapOutIsLoading={zapOutIsLoading}
          usdBalanceLoading={usdBalanceLoading}
          portfolioHelper={portfolioHelper}
          pendingRewards={pendingRewards}
        />
      )}
      {account === undefined ? (
        <ConfiguredConnectButton />
      ) : Object.values(chainStatus).filter((status) => status).length &&
        Object.values(chainStatus).filter((status) => status).length <
          availableAssetChains.length &&
        currentChain !==
          availableAssetChains.find((chain) => !chainStatus[chain]) ? (
        <Button
          type="primary"
          className="w-full"
          onClick={() =>
            switchChain(
              CHAIN_ID_TO_CHAIN[
                CHAIN_TO_CHAIN_ID[
                  availableAssetChains.find((chain) => !chainStatus[chain])
                ]
              ],
            )
          }
        >
          Switch to {availableAssetChains.find((chain) => !chainStatus[chain])}
        </Button>
      ) : Object.values(chainStatus).every((status) => status) ? null : (
        <Button
          type="primary"
          className={`w-full 
              ${
                Object.values(chainStatus).filter((status) => status).length ===
                availableAssetChains.length
                  ? "hidden"
                  : ""
              }`}
          onClick={() => handleAAWalletAction("zapOut", true)}
          loading={usdBalanceLoading}
          disabled={
            usdBalance < 0.01 ||
            zapOutPercentage === 0 ||
            selectedToken?.split("-")[0].toLowerCase() === "eth" ||
            lockUpPeriod > 0
          }
        >
          {lockUpPeriod > 0
            ? `Withdraw (unlocks in ${formatLockUpPeriod(lockUpPeriod)})`
            : "Withdraw"}
        </Button>
      )}
    </div>
  );
}
