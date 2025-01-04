import { Button, Input } from "antd";
import DecimalStep from "../../pages/indexes/DecimalStep";
import ConfiguredConnectButton from "../../pages/ConnectButton";

export default function TransferTab({
  selectedToken,
  handleSetSelectedToken,
  usdBalance,
  setZapOutPercentage,
  recipientError,
  validateRecipient,
  recipient,
  account,
  handleAAWalletAction,
  transferLoading,
  usdBalanceLoading,
}) {
  return (
    <div>
      <DecimalStep
        selectedToken={selectedToken}
        setSelectedToken={handleSetSelectedToken}
        depositBalance={usdBalance}
        setZapOutPercentage={setZapOutPercentage}
        currency="$"
        noTokenSelect={true}
      />
      <Input
        status={recipientError ? "error" : ""}
        placeholder="Recipient Address"
        onChange={(e) => validateRecipient(e.target.value)}
        value={recipient}
      />
      {recipientError && (
        <div className="text-red-500 text-sm mt-1">
          Please enter a valid Ethereum address different from your own
        </div>
      )}
      {account === undefined ? (
        <ConfiguredConnectButton />
      ) : (
        <Button
          type="primary"
          className="w-full"
          onClick={() => handleAAWalletAction("transfer", true)}
          loading={transferLoading || usdBalanceLoading}
          disabled={usdBalance < 0.01 || recipientError}
        >
          Transfer
        </Button>
      )}
    </div>
  );
}
