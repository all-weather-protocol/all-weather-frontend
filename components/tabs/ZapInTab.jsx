import { Button, Statistic, Switch } from "antd";
import TokenDropdownInput from "../../pages/views/TokenDropdownInput.jsx";
import ConfiguredConnectButton from "../../pages/ConnectButton";
import { getCurrentTimeSeconds } from "@across-protocol/app-sdk";
import { useState } from "react";
import { TOKEN_ADDRESS_MAP } from "../../utils/general";
import ActionItem from "../common/ActionItem";
import { getMinimumTokenAmount } from "../../utils/environment.js";

const { Countdown } = Statistic;
export default function ZapInTab({
  nextStepChain,
  selectedToken,
  handleSetSelectedToken,
  handleSetInvestmentAmount,
  tokenPricesMappingTable,
  account,
  protocolAssetDustInWallet,
  chainId,
  handleAAWalletAction,
  protocolAssetDustInWalletLoading,
  usdBalanceLoading,
  zapInIsLoading,
  investmentAmount,
  tokenBalance,
  setPreviousTokenSymbol,
  switchNextStepChain,
  walletBalanceData,
  showZapIn,
  setInvestmentAmount,
  setFinishedTxn,
  setShowZapIn,
  portfolioHelper,
  availableAssetChains,
  chainStatus,
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [showCountdown, setShowCountdown] = useState(false);
  const [deadline, setDeadline] = useState(null);
  const [enableBridging, setEnableBridging] = useState(true);

  const COUNTDOWN_TIME = 4;
  const currentChain = chainId?.name
    ?.toLowerCase()
    .replace(" one", "")
    .replace(" mainnet", "")
    .trim();
  const falseChains = availableAssetChains.filter(
    (chain) => !chainStatus[chain],
  );
  const skipBridge = availableAssetChains.length > falseChains.length;

  const shouldSkipBridge = () => {
    // Skip bridging if either:
    // 1. The switch is OFF (Single Chain mode)
    // 2. The original skipBridge condition is true
    return !enableBridging || skipBridge;
  };

  const handleSwitchChain = async (chain) => {
    setIsLoading(true);
    const deadlineTime = getCurrentTimeSeconds() + COUNTDOWN_TIME;
    setDeadline(deadlineTime * 1000);
    setShowCountdown(true);
    switchNextStepChain(chain);

    await new Promise((resolve) => setTimeout(resolve, COUNTDOWN_TIME * 1000));

    setPreviousTokenSymbol(selectedToken.split("-")[0].toLowerCase());
    const tokenSymbol = selectedToken.split("-")[0].toLowerCase();
    if (tokenSymbol === "usdt") {
      const newSelectedToken = `usdc-${TOKEN_ADDRESS_MAP["usdc"][nextStepChain]}-6`;
      handleSetSelectedToken(newSelectedToken);
    }

    setShowCountdown(false);
    setIsLoading(false);
  };

  const renderCountdown = () => {
    if (!showCountdown || !deadline) return null;

    return (
      <div className="mb-4">
        <Countdown
          title="Bridging tokens..."
          value={deadline}
          onFinish={() => setShowCountdown(false)}
          style={{
            backgroundColor: "#ffffff",
            padding: "10px",
            borderRadius: "8px",
          }}
          className="text-white"
        />
      </div>
    );
  };

  const renderActionButton = () => {
    if (account === undefined) {
      return <ConfiguredConnectButton />;
    }
    return (
      <>
        <Button
          type="primary"
          className="w-full my-2"
          onClick={() => handleAAWalletAction("zapIn", shouldSkipBridge())}
          disabled={
            Number(investmentAmount) === 0 ||
            Number(investmentAmount) > tokenBalance ||
            Number(investmentAmount) < getMinimumTokenAmount(selectedToken)
          }
        >
          Zap In
        </Button>
        <Switch
          checkedChildren="Cross Chain"
          unCheckedChildren="Single Chain"
          defaultChecked={true}
          onChange={(checked) => setEnableBridging(checked)}
        />
      </>
    );
  };

  const renderSwitchChainButton = () => {
    const nextChain = availableAssetChains.find((chain) => !chainStatus[chain]);
    const shouldShow = currentChain !== nextChain;

    if (!shouldShow) return null;

    return (
      <Button
        type="primary"
        className="w-full my-2"
        onClick={() => {
          handleSwitchChain(nextChain);
          setFinishedTxn(false);
        }}
        loading={isLoading}
      >
        switch to {nextChain} Chain
      </Button>
    );
  };

  return (
    <div>
      <ActionItem
        tab="ZapIn"
        actionName="zapIn"
        availableAssetChains={availableAssetChains}
        currentChain={currentChain}
        chainStatus={chainStatus}
        theme="dark"
        isStarted={Object.values(chainStatus || {}).some((status) => status)}
        account={account}
      />

      <div
        className={`mt-4 sm:mt-0 ${
          chainStatus[currentChain] ? "hidden" : "block"
        }`}
      >
        <TokenDropdownInput
          selectedToken={selectedToken}
          setSelectedToken={handleSetSelectedToken}
          setInvestmentAmount={handleSetInvestmentAmount}
          tokenPricesMappingTable={tokenPricesMappingTable}
        />
        {renderActionButton()}
      </div>

      <div
        className={`mt-4 ${
          chainStatus[currentChain] && falseChains.length > 0
            ? "block"
            : "hidden"
        }`}
      >
        {renderCountdown()}
        {renderSwitchChainButton()}
      </div>
    </div>
  );
}
