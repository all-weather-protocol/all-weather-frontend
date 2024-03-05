import "./styles.css";
import {
  EtherspotBatches,
  EtherspotBatch,
  EtherspotTransaction,
  useEtherspotTransactions,
  useWalletAddress,
} from "@etherspot/transaction-kit";

import React from "react";

export default function App() {
  const [address, setAddress] = React.useState(
    "0x271Ae6E03257264F0F7cb03506b12A027Ec53B31",
  );
  const [amount, setAmount] = React.useState("0.001");
  const { estimate, send } = useEtherspotTransactions();
  const etherspotAddresses = useWalletAddress("etherspot-prime", 80001);

  React.useEffect(() => {
    console.log(etherspotAddresses);
  }, [etherspotAddresses]);

  return (
    <div className="App">
      <h1>Etherspot Demo</h1>
      <h2>Let's send some mumbai matic.</h2>
      <code>{JSON.stringify(etherspotAddresses)}</code>

      <EtherspotBatches>
        <EtherspotBatch chainId={80001}>
          <EtherspotTransaction to={address} value={amount}>
            <input
              type="text"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
            />
            <input
              type="text"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
            <hr />
            <button onClick={() => estimate()}>Estimate</button>
            <button onClick={() => send()}>Send</button>
          </EtherspotTransaction>
        </EtherspotBatch>
      </EtherspotBatches>
    </div>
  );
}
