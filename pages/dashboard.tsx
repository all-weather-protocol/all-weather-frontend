import type { NextPage } from "next";
import BasePage from "./basePage.tsx";
import { Spin, Table } from "antd";
import { Input } from "antd";
const { Search } = Input;
import useRebalanceSuggestions from "../utils/rebalanceSuggestions.js";
import { useWindowHeight } from "../utils/chartUtils.js";
import { getColumnsForSuggestionsTable } from "../utils/tableExpansionUtils";
import { selectBefore } from "../utils/contractInteractions";
import { useState, useEffect } from "react";

const Dashboard: NextPage = () => {
  const { topNLowestAprPools } = useRebalanceSuggestions();
  const windowHeight = useWindowHeight();
  const divBetterPools = {
    padding: "0 8px",
    minHeight: windowHeight,
    color: "#ffffff",
  };
  const commonColumns = getColumnsForSuggestionsTable(100);
  const [poolData, setPoolData] = useState({ data: [] });
  const [chosenTokenA, setChosenTokenA] = useState("");
  const [chosenTokenB, setChosenTokenB] = useState("");

  const searchBetterPools = () => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/pools`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_api_key: "test",
        tokens: [
          { symbol: chosenTokenA, is_stablecoin: false },
          { symbol: chosenTokenB, is_stablecoin: false },
        ],
      }),
    })
      .then((response) => response.json())
      .then((json) => {
        setPoolData(json);
        console.log("poolData", poolData);
      })
      .catch((error) => {
        console.log("failed to fetch pool data", error);
      });
  };

  return (
    <BasePage>
      <div style={divBetterPools}>
        <center>
          <h1>Better Pools Search Engine</h1>
        </center>
        {topNLowestAprPools.length === 0 ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "15rem",
            }}
          >
            <Spin size="large" />
          </div>
        ) : (
          <>
            <Search
              placeholder="input your wallet address"
              onSearch={searchBetterPools}
            />
            {selectBefore((value: string) => {
              setChosenTokenA(value);
            })}
            {selectBefore((value: string) => {
              setChosenTokenB(value);
            })}
            <h2 className="ant-table-title">Search Result:</h2>
            <Table
              columns={commonColumns}
              dataSource={poolData.data}
              pagination={false}
            />
            <h2 className="ant-table-title">Better BTC-ETH Coin Pools:</h2>
            <Table
              columns={commonColumns}
              dataSource={btcEthPair}
              pagination={false}
            />
            <h2 className="ant-table-title">Better Stable Coin Pools:</h2>
            <Table
              columns={commonColumns}
              dataSource={stableCoinData}
              pagination={false}
            />
            <h2 className="ant-table-title">Better ETH Coin Pools:</h2>
            <Table
              columns={commonColumns}
              dataSource={ethData}
              pagination={false}
            />
          </>
        )}
      </div>
    </BasePage>
  );
};

const btcEthPair = [
  {
    key: "1",
    chain: "linea",
    pool: "Velocore",
    coin: ["BTC", "ETH"],
    tvlUsd: 0.7118,
    apr: 0.3765,
  },
  {
    key: "2",
    chain: "arbitrum",
    pool: "uniswap-v3",
    coin: ["BTC", "ETH"],
    tvlUsd: 2.223,
    apr: 0.2515,
  },
];
const ethData = [
  {
    key: "1",
    chain: "linea",
    pool: "Velocore",
    coin: ["WSTETH", "ETH"],
    tvlUsd: 0.61,
    apr: 0.2581,
  },
];
const stableCoinData = [
  {
    key: "1",
    chain: "arbitrum",
    pool: "solv-funds",
    coin: ["USDT"],
    tvlUsd: 3.28,
    apr: 0.8211,
  },
  {
    key: "2",
    chain: "polygon",
    pool: "idle",
    coin: ["USDT"],
    tvlUsd: 657400,
    apr: 0.6574,
  },
  {
    key: "3",
    chain: "ethereum",
    pool: "opyn-squeeth",
    coin: ["USDC"],
    tvlUsd: 646600,
    apr: 0.6466,
  },
];

export default Dashboard;
