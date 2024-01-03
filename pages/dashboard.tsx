import type { NextPage } from "next";
import BasePage from "./basePage.tsx";
import { Spin, Table } from "antd";
import { Input } from "antd";
const { Search } = Input;
import useRebalanceSuggestions from "../utils/rebalanceSuggestions.js";
import { useWindowHeight } from "../utils/chartUtils.js";
import {
  getColumnsForSuggestionsTable,
  getExpandableColumnsForSuggestionsTable,
  expandedRowRender,
} from "../utils/tableExpansionUtils";
import { selectBefore } from "../utils/contractInteractions";
import { useState, useEffect } from "react";
interface Pool {
  apr: number;
  tokens: string[];
  data: object[];
  // ... include other relevant properties as needed
}
interface Query {
  symbol: string;
  is_stablecoin: boolean;
}
interface queriesObj {
  category: string;
  queries: Query[][]; // Array of arrays of Query objects
  setStateMethod: (newValue: any) => void; // Assuming setStateMethod is a function that takes any type as an argument
  state: Pool[] | null;
}
const Dashboard: NextPage = () => {
  const userApiKey = "placeholder";
  const { topNLowestAprPools } = useRebalanceSuggestions();
  const windowHeight = useWindowHeight();
  const divBetterPools = {
    padding: "0 8px",
    minHeight: windowHeight,
    color: "#ffffff",
  };
  const commonColumns = getColumnsForSuggestionsTable();
  const expandableColumns = getExpandableColumnsForSuggestionsTable();
  const [poolData, setPoolData] = useState<Pool[] | null>(null);
  const [longTermBond, setLongTermBond] = useState<Pool[] | null>(null);
  const [intermediateTermBond, setIntermediateTermBond] = useState<
    Pool[] | null
  >(null);
  const [goldData, setGoldData] = useState<Pool[] | null>(null);
  const [commodities, setCommodities] = useState<Pool[] | null>(null);
  const [large_cap_us_stocks, set_large_cap_us_stocks] = useState<
    Pool[] | null
  >(null);
  const [small_cap_us_stocks, set_small_cap_us_stocks] = useState<
    Pool[] | null
  >(null);
  const [non_us_developed_market_stocks, set_non_us_developed_market_stocks] =
    useState<Pool[] | null>(null);
  const [non_us_emerging_market_stocks, set_non_us_emerging_market_stocks] =
    useState<Pool[] | null>(null);
  const unexpandableCategories = [
    "ETH (Long Term Bond)",
    "Stablecoins (Intermediate Bond)",
    "ETH-Stablecoin LP Tokens (Gold)",
  ];
  const [chosenTokenA, setChosenTokenA] = useState("");
  const [chosenTokenB, setChosenTokenB] = useState("");

  const topN = 5;
  const queriesForAllWeather: queriesObj[] = [
    {
      category: "ETH (Long Term Bond)",
      queries: [
        [
          { symbol: "eth", is_stablecoin: false },
          { symbol: "eth", is_stablecoin: false },
        ],
        [{ symbol: "eth", is_stablecoin: false }],
      ],
      setStateMethod: setLongTermBond,
      state: longTermBond,
    },
    {
      category: "Stablecoins (Intermediate Bond)",
      queries: [
        [
          { symbol: "usd", is_stablecoin: true },
          { symbol: "usd", is_stablecoin: true },
        ],
        [{ symbol: "usd", is_stablecoin: true }],
      ],
      setStateMethod: setIntermediateTermBond,
      state: intermediateTermBond,
    },
    {
      category: "ETH-Stablecoin LP Tokens (Gold)",
      queries: [
        [
          { symbol: "eth", is_stablecoin: false },
          { symbol: "usd", is_stablecoin: true },
        ],
        [{ symbol: "alp", is_stablecoin: false }],
        [{ symbol: "glp", is_stablecoin: false }],
        [{ symbol: "hlp", is_stablecoin: false }],
        [{ symbol: "vlp", is_stablecoin: false }],
      ],
      setStateMethod: setGoldData,
      state: goldData,
    },
    {
      category: "Gas Tokens (Commodities)",
      queries: [
        [
          { symbol: "eth", is_stablecoin: false },
          { symbol: "op", is_stablecoin: false },
        ],
        [
          { symbol: "eth", is_stablecoin: false },
          { symbol: "fxs", is_stablecoin: false },
        ],
        [
          { symbol: "eth", is_stablecoin: false },
          { symbol: "sol", is_stablecoin: false },
        ],
        [
          { symbol: "eth", is_stablecoin: false },
          { symbol: "rdnr", is_stablecoin: false },
        ],
        [
          { symbol: "eth", is_stablecoin: false },
          { symbol: "tia", is_stablecoin: false },
        ],
        [
          { symbol: "eth", is_stablecoin: false },
          { symbol: "link", is_stablecoin: false },
        ],
      ],
      setStateMethod: setCommodities,
      state: commodities,
    },
    {
      category: "Large Cap Defi Tokens (Large Cap US Stocks)",
      queries: [
        [
          { symbol: "eth", is_stablecoin: false },
          { symbol: "cake", is_stablecoin: false },
        ],
        [
          { symbol: "eth", is_stablecoin: false },
          { symbol: "crv", is_stablecoin: false },
        ],
        [
          { symbol: "eth", is_stablecoin: false },
          { symbol: "pendle", is_stablecoin: false },
        ],
        [
          { symbol: "eth", is_stablecoin: false },
          { symbol: "rdnt", is_stablecoin: false },
        ],
      ],
      setStateMethod: set_large_cap_us_stocks,
      state: large_cap_us_stocks,
    },
    {
      category: "Small Cap Defi Tokens (Small Cap US Stocks)",
      queries: [
        [
          { symbol: "eth", is_stablecoin: false },
          { symbol: "velo", is_stablecoin: false },
        ],
        [
          { symbol: "eth", is_stablecoin: false },
          { symbol: "lyra", is_stablecoin: false },
        ],
      ],
      setStateMethod: set_small_cap_us_stocks,
      state: small_cap_us_stocks,
    },
    {
      category: "DePIN (Non US Developed Market Stocks)",
      queries: [
        [
          { symbol: "eth", is_stablecoin: false },
          { symbol: "ssv", is_stablecoin: false },
        ],
        [
          { symbol: "eth", is_stablecoin: false },
          { symbol: "tia", is_stablecoin: false },
        ],
        [
          { symbol: "eth", is_stablecoin: false },
          { symbol: "grt", is_stablecoin: false },
        ],
      ],
      setStateMethod: set_non_us_emerging_market_stocks,
      state: non_us_emerging_market_stocks,
    },
    {
      category: "Cutting-Edges (Non US Emerging Market Stocks (3%)",
      queries: [
        [
          { symbol: "sol", is_stablecoin: false },
          { symbol: "render", is_stablecoin: false },
        ],
        [
          { symbol: "sol", is_stablecoin: false },
          { symbol: "hnt", is_stablecoin: false },
        ],
      ],
      setStateMethod: set_non_us_developed_market_stocks,
      state: non_us_developed_market_stocks,
    },
  ];
  useEffect(() => {
    const fetchDefaultPools = async () => {
      try {
        for (const categoryMetaData of Object.values(queriesForAllWeather)) {
          // Array to store the results from each fetch
          let combinedData: Pool[] = [];
          // Loop through each configuration and perform the fetch
          for (const query of categoryMetaData.queries) {
            const response = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/pools`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  user_api_key: userApiKey,
                  tokens: query,
                  top_n: topN,
                }),
              },
            );
            const json = await response.json();
            if (json.data.length === 0) {
              continue;
            }
            if (unexpandableCategories.includes(categoryMetaData.category)) {
              combinedData = combinedData.concat(json.data);
            } else {
              combinedData.push({
                tokens: json.data[0].tokens,
                apr: json.data[0].apr,
                data: json.data,
              });
            }
          }

          // Sort and update the state
          combinedData.sort((poolA, poolB) => poolB.apr - poolA.apr);
          if (unexpandableCategories.includes(categoryMetaData.category)) {
            categoryMetaData.setStateMethod(combinedData.slice(0, topN));
          } else {
            categoryMetaData.setStateMethod(combinedData);
          }
        }
      } catch (error) {
        console.log("failed to fetch pool data", error);
      }
    };

    fetchDefaultPools();
  }, []);

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
        setPoolData(json.data);
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
        <>
          {/* <Search
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
              dataSource={poolData}
              pagination={false}
            /> */}
          {Object.values(queriesForAllWeather).map((categoryMetaData) => {
            return (
              <div key={categoryMetaData.category}>
                {" "}
                {/* Make sure to provide a unique key for each item */}
                <h2 className="ant-table-title">{categoryMetaData.category}</h2>
                {categoryMetaData.state === null ? (
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
                ) : unexpandableCategories.includes(
                    categoryMetaData.category,
                  ) ? (
                  <Table
                    columns={expandableColumns}
                    dataSource={categoryMetaData.state}
                    pagination={false}
                  />
                ) : (
                  <Table
                    columns={commonColumns}
                    expandable={{
                      expandedRowRender,
                      defaultExpandedRowKeys: ["0"],
                    }}
                    dataSource={categoryMetaData.state}
                    pagination={false}
                  />
                )}
              </div>
            );
          })}
        </>
      </div>
    </BasePage>
  );
};

export default Dashboard;
