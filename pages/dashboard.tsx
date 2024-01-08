import type { NextPage } from "next";
import BasePage from "./basePage.tsx";
import { Spin, Table } from "antd";
import { Input, Image } from "antd";
import type { ColumnsType } from "antd/es/table";

const { Search } = Input;
import useRebalanceSuggestions from "../utils/rebalanceSuggestions.js";
import { useWindowHeight } from "../utils/chartUtils.js";
import {
  getBasicColumnsForSuggestionsTable,
  getExpandableColumnsForSuggestionsTable,
  columnMapping,
} from "../utils/tableExpansionUtils";
import { selectBefore } from "../utils/contractInteractions";
import { useState, useEffect } from "react";
import { string } from "zod";
import RebalanceChart from "./views/RebalanceChart";
import exp from "constants";

interface Pools {
  key: string;
  apr: number;
  tokens: string[];
  data: Pool[];
  // ... include other relevant properties as needed
}
interface Pool {
  poolID: string;
  [key: string]: any;
}
interface Query {
  symbol: string;
  is_stablecoin: boolean;
}
interface queriesObj {
  category: string;
  queries: Query[][]; // Array of arrays of Query objects
  setStateMethod: (newValue: any) => void; // Assuming setStateMethod is a function that takes any type as an argument
  state: Pools[] | null;
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
  const basicColumns = getBasicColumnsForSuggestionsTable();
  const expandableColumns = getExpandableColumnsForSuggestionsTable();
  const [poolData, setPoolData] = useState<Pools[] | null>(null);
  const [longTermBond, setLongTermBond] = useState<Pools[] | null>(null);
  const [intermediateTermBond, setIntermediateTermBond] = useState<
    Pools[] | null
  >(null);
  const [goldData, setGoldData] = useState<Pools[] | null>(null);
  const [commodities, setCommodities] = useState<Pools[] | null>(null);
  const [large_cap_us_stocks, set_large_cap_us_stocks] = useState<
    Pools[] | null
  >(null);
  const [small_cap_us_stocks, set_small_cap_us_stocks] = useState<
    Pools[] | null
  >(null);
  const [non_us_developed_market_stocks, set_non_us_developed_market_stocks] =
    useState<Pools[] | null>(null);
  const [non_us_emerging_market_stocks, set_non_us_emerging_market_stocks] =
    useState<Pools[] | null>(null);
  const [portfolioComposition, setPortfolioComposition] = useState<{
    [key: string]: any;
  }>({});
  const unexpandableCategories = [
    "ETH (Long Term Bond)",
    "Stablecoins (Intermediate Bond)",
    "ETH-Stablecoin LP Tokens (Gold)",
  ];
  const [chosenTokenA, setChosenTokenA] = useState("");
  const [chosenTokenB, setChosenTokenB] = useState("");

  const topN = 3;
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
          { symbol: "usd", is_stablecoin: true },
          { symbol: "op", is_stablecoin: false },
        ],
        [
          { symbol: "eth", is_stablecoin: false },
          { symbol: "fxs", is_stablecoin: false },
        ],
        [
          { symbol: "usd", is_stablecoin: true },
          { symbol: "fxs", is_stablecoin: false },
        ],
        [
          { symbol: "eth", is_stablecoin: false },
          { symbol: "sol", is_stablecoin: false },
        ],
        [
          { symbol: "usd", is_stablecoin: true },
          { symbol: "sol", is_stablecoin: false },
        ],
        [
          { symbol: "eth", is_stablecoin: false },
          { symbol: "render", is_stablecoin: false },
        ],
        [
          { symbol: "usd", is_stablecoin: true },
          { symbol: "render", is_stablecoin: false },
        ],
        [
          { symbol: "eth", is_stablecoin: false },
          { symbol: "tia", is_stablecoin: false },
        ],
        [
          { symbol: "usd", is_stablecoin: true },
          { symbol: "tia", is_stablecoin: false },
        ],
        [
          { symbol: "eth", is_stablecoin: false },
          { symbol: "link", is_stablecoin: false },
        ],
        [
          { symbol: "usd", is_stablecoin: true },
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
        [
          { symbol: "eth", is_stablecoin: false },
          { symbol: "fxs", is_stablecoin: false },
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
      category: "Cutting-Edges (Non US Emerging Market Stocks (3%)",
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
      category: "DePIN (Non US Developed Market Stocks)",
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
  const currentBestPortfolio = [
    {
      apr: 46.10463719702651,
      apyBase: 30.17605,
      apyMean30d: 25.82988,
      apyReward: 28.35106,
      chain: "arbitrum",
      count: 128,
      exposure: "single",
      mu: 9.09524,
      outlier: false,
      pool: {
        meta: "Dolomite Balance",
        name: "dolomite",
      },
      poolID: "d0e11625-79b9-40e3-b01f-a473af961995",
      poolMeta: "Dolomite Balance",
      predictions: {
        binnedConfidence: 3,
        predictedClass: "Down",
        predictedProbability: 96,
      },
      rewardTokens: ["0x912CE59144191C1204E64559FE8253a0e49E6548"],
      sigma: 0.64883,
      stablecoin: true,
      symbol: "usdc",
      tokens: ["USDC"],
      tvlUsd: 543196,
      underlyingTokens: ["0xaf88d065e77c8cC2239327C5EDb3A432268e5831"],
      volumeUsd7d: null,
      categories: ["Stablecoins (Intermediate Bond)"],
      weight: 0.07,
      key: "1",
    },
    {
      apr: 112.42539484323267,
      apyBase: 47.1722,
      apyMean30d: 266.35264,
      apyReward: 160.08839,
      chain: "metis",
      count: 190,
      exposure: "multi",
      mu: 125.8543,
      outlier: true,
      pool: {
        meta: "0.3%",
        name: "maia-v3",
      },
      poolID: "c2870121-0a77-4480-9dc7-51289b1aae06",
      poolMeta: "0.3%",
      predictions: {
        binnedConfidence: 3,
        predictedClass: "Down",
        predictedProbability: 98,
      },
      rewardTokens: ["0xdeaddeaddeaddeaddeaddeaddeaddeaddead0000"],
      sigma: 1.61111,
      stablecoin: false,
      symbol: "weth-m.usdc",
      tokens: ["WETH", "M.USDC"],
      tvlUsd: 520334,
      underlyingTokens: [
        "0x420000000000000000000000000000000000000a",
        "0xea32a96608495e54156ae48931a7c20f0dcc1a21",
      ],
      volumeUsd7d: 1691640.82207,
      categories: [
        "ETH-Stablecoin LP Tokens (Gold)",
        "ETH (Long Term Bond)",
        "Stablecoins (Intermediate Bond)",
      ],
      weight: 0.3,
      key: "0",
    },
    {
      key: "0",
      chain: "optimism",
      pool: {
        meta: "0.3%",
        name: "uniswap-v3",
      },
      tokens: ["OP", "USDC"],
      tvlUsd: 1223255,
      apr: 149.02417778193544,
      poolID: "32defd51-75c3-44af-822e-292bd693e13b",
      weight: 0.01,
      categories: [
        "Gas Tokens (Commodities)",
        "Stablecoins (Intermediate Bond)",
      ],
    },
    {
      key: "0",
      chain: "solana",
      pool: {
        meta: null,
        name: "orca",
      },
      tokens: ["SOL", "USDC"],
      tvlUsd: 505448,
      apr: 114.73024159183376,
      poolID: "a5c85bc8-eb41-45c0-a520-d18d7529c0d8",
      weight: 0.04,
      categories: [
        "Gas Tokens (Commodities)",
        "Stablecoins (Intermediate Bond)",
        "DePIN (Non US Developed Market Stocks)",
      ],
    },
    {
      key: "0",
      chain: "optimism",
      pool: {
        meta: "0.3%",
        name: "uniswap-v3",
      },
      tokens: ["WETH", "OP"],
      tvlUsd: 9661557,
      apr: 102.88906331302871,
      poolID: "b023d35a-f511-4650-9518-03a4728cda76",
      weight: 0.01,
      categories: ["Gas Tokens (Commodities)", "ETH (Long Term Bond)"],
    },
    {
      key: "0",
      chain: "osmosis",
      pool: {
        meta: "14day",
        name: "osmosis-dex",
      },
      tokens: ["USDC", "TIA"],
      tvlUsd: 382815,
      apr: 86.77451372192213,
      poolID: "4d0e0b7c-eac9-4374-bbd5-94bba240c2e6",
      weight: 0.01,
      categories: [
        "Gas Tokens (Commodities)",
        "Stablecoins (Intermediate Bond)",
      ],
    },
    {
      key: "0",
      chain: "arbitrum",
      pool: {
        meta: "1%",
        name: "uniswap-v3",
      },
      tokens: ["WETH", "FXS"],
      tvlUsd: 251186,
      apr: 84.58496481527055,
      poolID: "ae8bfa0a-143a-4741-b878-1aebd628d287",
      weight: 0.01,
      categories: [
        "Gas Tokens (Commodities)",
        "ETH (Long Term Bond)",
        "Large Cap Defi Tokens (Large Cap US Stocks)",
      ],
    },
    {
      key: "0",
      chain: "arbitrum",
      pool: {
        meta: null,
        name: "joe-v2.1",
      },
      tokens: ["LINK", "WETH"],
      tvlUsd: 556963,
      apr: 62.98064385184799,
      poolID: "30379464-6318-400b-925a-0226d6a690cf",
      weight: 0.01,
      categories: ["Gas Tokens (Commodities)", "ETH (Long Term Bond)"],
    },
    {
      key: "0",
      chain: "solana",
      pool: {
        meta: null,
        name: "orca",
      },
      tokens: ["SOL", "WHETH"],
      tvlUsd: 662065,
      apr: 55.23105820533081,
      poolID: "69c64232-ef1a-45f2-b49b-daeb2a906873",
      weight: 0.01,
      categories: [
        "Gas Tokens (Commodities)",
        "ETH (Long Term Bond)",
        "DePIN (Non US Developed Market Stocks)",
      ],
    },
    {
      key: "0",
      chain: "arbitrum",
      pool: {
        meta: "0.3%",
        name: "uniswap-v3",
      },
      tokens: ["RDNT", "WETH"],
      tvlUsd: 1488866,
      apr: 170.36080359071605,
      poolID: "04a3e057-4cca-4928-bd52-6e1e8ae45b12",
      weight: 0.045,
      categories: [
        "ETH (Long Term Bond)",
        "Large Cap Defi Tokens (Large Cap US Stocks)",
      ],
    },
    {
      key: "0",
      chain: "arbitrum",
      pool: {
        meta: null,
        name: "camelot-v3",
      },
      tokens: ["PENDLE", "WETH"],
      tvlUsd: 739509,
      apr: 152.4797211038773,
      poolID: "ad4fc370-78de-4203-9146-d7545a3f895f",
      weight: 0.21,
      categories: [
        "ETH (Long Term Bond)",
        "Large Cap Defi Tokens (Large Cap US Stocks)",
      ],
    },
    {
      key: "0",
      chain: "bsc",
      pool: {
        meta: "0.25%",
        name: "pancakeswap-amm-v3",
      },
      tokens: ["CAKE", "ETH"],
      tvlUsd: 428668,
      apr: 68.15004448462636,
      poolID: "66c6f3f2-124c-4929-b0f8-27122fb725fd",
      weight: 0.045,
      categories: [
        "ETH (Long Term Bond)",
        "Large Cap Defi Tokens (Large Cap US Stocks)",
      ],
    },
    {
      key: "0",
      chain: "optimism",
      pool: {
        meta: "volatile - 1%",
        name: "velodrome-v2",
      },
      tokens: ["WETH", "VELO"],
      tvlUsd: 316891,
      apr: 48.24551738796823,
      poolID: "09921e93-8c35-46fb-94ba-9fe0580a2a88",
      weight: 0.01,
      categories: [
        "ETH (Long Term Bond)",
        "Small Cap Defi Tokens (Small Cap US Stocks)",
      ],
    },
    {
      key: "0",
      chain: "solana",
      pool: {
        meta: null,
        name: "kamino-liquidity",
      },
      tokens: ["SOL", "HNT"],
      tvlUsd: 208896,
      apr: 121.13482832483568,
      poolID: "889816db-0dee-43bd-be0c-ef84c5d220e7",
      categories: [
        "Gas Tokens (Commodities)",
        "DePIN (Non US Developed Market Stocks)",
      ],
      weight: 0.01,
    },
    {
      key: "0",
      chain: "solana",
      pool: {
        meta: null,
        name: "orca",
      },
      tokens: ["SOL", "RENDER"],
      tvlUsd: 709150,
      apr: 104.72346059442495,
      poolID: "4376015c-0cde-4a59-b7cc-ed2ee92277c1",
      categories: [
        "Gas Tokens (Commodities)",
        "DePIN (Non US Developed Market Stocks)",
      ],
      weight: 0.01,
    },
    {
      apr: 17.110941540709355,
      apyBase: 1.26655,
      apyMean30d: 17.75688,
      apyReward: 17.39074,
      chain: "arbitrum",
      count: 223,
      exposure: "single",
      mu: 3.14901,
      outlier: false,
      pool: {
        meta: "Dolomite Balance",
        name: "dolomite",
      },
      poolID: "655ca962-e0ac-424c-84f9-2fe4fbb0fef4",
      poolMeta: "Dolomite Balance",
      predictions: {
        binnedConfidence: 3,
        predictedClass: "Down",
        predictedProbability: 91,
      },
      rewardTokens: ["0x912CE59144191C1204E64559FE8253a0e49E6548"],
      sigma: 0.35038,
      stablecoin: false,
      symbol: "weth",
      tokens: ["WETH"],
      tvlUsd: 4266341,
      underlyingTokens: ["0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"],
      volumeUsd7d: null,
      categories: ["ETH (Long Term Bond)"],
      weight: 0.2,
      key: "1",
    },
  ];
  const totalWeight = Object.values(currentBestPortfolio).reduce(
    (acc, item) => acc + item.weight,
    0,
  );

  const uniqueTokens = new Set();
  queriesForAllWeather.forEach((item) => {
    if (!unexpandableCategories.includes(item.category)) {
      item.queries.forEach((queryGroup) => {
        queryGroup.forEach((query) => {
          if (!query.is_stablecoin) {
            uniqueTokens.add(query.symbol);
          }
        });
      });
    }
  });

  useEffect(() => {
    const fetchDefaultPools = async () => {
      try {
        for (const categoryMetaData of Object.values(queriesForAllWeather)) {
          // Array to store the results from each fetch
          let combinedData: Pools[] = [];
          // Loop through each configuration and perform the fetch
          for (const [index, query] of categoryMetaData.queries.entries()) {
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
            json.data = _transformData(json.data, categoryMetaData.category);
            if (unexpandableCategories.includes(categoryMetaData.category)) {
              combinedData = combinedData.concat(json.data);
            } else {
              combinedData.push({
                key: index.toString(),
                tokens: json.data[0].tokens,
                apr: json.data[0].apr,
                data: json.data,
              });
            }
          }

          // Sort and update the state
          combinedData.sort((poolA, poolB) => poolB.apr - poolA.apr);
          if (unexpandableCategories.includes(categoryMetaData.category)) {
            const keyedCombineData = combinedData.map((item, index) => ({
              ...item,
              key: index.toString(), // Adds a new key with the index as its value
            }));
            categoryMetaData.setStateMethod(keyedCombineData.slice(0, topN));
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

  const _transformData = (data: Pools[], category: string) => {
    return data.map((item) => ({
      ...item,
      categories: [category],
      weight: 0.3,
    }));
  };
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
  const expandedRowRender = (records: Pools) => {
    const columns = [
      columnMapping["chain"],
      columnMapping["pool"],
      columnMapping["tokens"],
      columnMapping["tvlUsd"],
      columnMapping["apr"],
    ];
    const data = [];
    for (let index = 0; index < records.data.length; index++) {
      data.push({
        key: index.toString(),
        chain: records.data[index].chain,
        pool: records.data[index].pool,
        tokens: records.data[index].tokens,
        tvlUsd: records.data[index].tvlUsd,
        apr: records.data[index].apr,
        poolID: records.data[index].poolID,
      });
    }
    return (
      <Table
        columns={columns}
        dataSource={data}
        pagination={false}
        rowSelection={{
          onSelect: (record: Pool, selected: boolean) => {
            if (selected === true) {
              portfolioComposition[record.poolID] = record;
            } else {
              delete portfolioComposition[record.poolID];
            }
            setPortfolioComposition(portfolioComposition);
            console.log(Object.values(portfolioComposition), "in selected");
          },
        }}
      />
    );
  };
  return (
    <BasePage>
      <div style={divBetterPools}>
        <center>
          <h1>Better Pools Search Engine</h1>
        </center>
        <h2 className="ant-table-title">
          Tokens in Current Portfolio: {uniqueTokens.size}
          {Array.from(uniqueTokens).map((token: unknown, index) => (
            <Image
              key={index}
              src={`/tokenPictures/${token}.webp`}
              alt={token as string}
              height={20}
              width={20}
            />
          ))}
          <RebalanceChart
            rebalanceSuggestions={[]}
            netWorth={100}
            windowWidth={200}
            showCategory={false}
            mode="portfolioComposer"
            // portfolioComposition={Object.values(portfolioComposition)}
            portfolioComposition={currentBestPortfolio}
          />
        </h2>
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
              columns={basicColumns}
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
                    columns={basicColumns}
                    dataSource={categoryMetaData.state}
                    pagination={false}
                    rowSelection={{
                      onSelect: (record: Pool, selected: boolean) => {
                        if (selected === true) {
                          portfolioComposition[record.poolID] = record;
                        } else {
                          delete portfolioComposition[record.poolID];
                        }
                        setPortfolioComposition(portfolioComposition);
                        console.log(
                          JSON.stringify(Object.values(portfolioComposition)),
                          "in selected",
                        );
                      },
                    }}
                  />
                ) : (
                  <Table
                    columns={expandableColumns}
                    expandable={{
                      expandedRowRender,
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
