import React from "react";
import { useEffect, useState, useContext } from "react";
import RebalancerWidget from "./Rebalancer";
import PortfolioMetaTab from "./PortfolioMetaTab";
import { Button } from "antd";
import Link from "next/link";
import { web3Context } from "./Web3DataProvider";
import { useWindowHeight } from "../../utils/chartUtils";

export default function ExampleUI() {
  const windowHeight = useWindowHeight();
  const WEB3_CONTEXT = useContext(web3Context);
  const [loadingState, setLoadingState] = useState(true);
  useEffect(() => {
    async function fetchPortfolioMetadata() {
      if (WEB3_CONTEXT !== undefined) {
        setLoadingState(false);
      }
    }
    fetchPortfolioMetadata();
  }, [WEB3_CONTEXT]);
  return (
    <div style={{ padding: "3rem 1.5rem", minHeight: windowHeight }}>
      <center>
        <h1 className="ant-table-title">
          All Weather Portfolio: Biggest Liquidity Mining Index Fund
        </h1>
      </center>
      <center>
        <h3 className="ant-table-title">
          Don&apos;t trade your time for money to retire anymore. Click Once,
          Retire Forever!
        </h3>
        <Link href="#zapSection">
          <Button type="primary" loading={loadingState}>
            Invest Now!
          </Button>
        </Link>
        <PortfolioMetaTab />
      </center>
      <RebalancerWidget />
    </div>
  );
}
