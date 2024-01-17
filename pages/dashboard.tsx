import type { NextPage } from "next";
import BasePage from "./basePage.tsx";
import { Spin, Table, Button } from "antd";
import { Image } from "antd";
import useRebalanceSuggestions from "../utils/rebalanceSuggestions.js";
import { useWindowHeight } from "../utils/chartUtils.js";
import {
  getBasicColumnsForSuggestionsTable,
  getExpandableColumnsForSuggestionsTable,
  columnMapping,
} from "../utils/tableExpansionUtils";
import { useState, useEffect } from "react";
import RebalanceChart from "./views/RebalanceChart";

interface Pools {
  key: string;
  apr: number;
  tokens: string[];
  data: Pool[];
  // ... include other relevant properties as needed
}
interface Pool {
  [key: string]: any;
  pool: { meta: string; name: string; poolID: string };
}
interface queriesObj {
  wording: string;
  category: string;
  setStateMethod: (newValue: any) => void; // Assuming setStateMethod is a function that takes any type as an argument
  state: Pools[] | null;
  setUniqueQueryTokens: (newValue: any) => void;
  uniqueQueryTokens: { [key: string]: any };
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

  const [longTermBondFilterDict, setLongTermBondFilterDict] = useState<{}>({});
  const [intermediateTermBondFilterDict, setIntermediateTermBondFilterDict] =
    useState<{}>({});
  const [goldDataFilterDict, setGoldDataFilterDict] = useState<{}>({});
  const [commoditiesFilterDict, setCommoditiesFilterDict] = useState<{}>({});
  const [large_cap_us_stocksFilterDict, setLarge_cap_us_stocksFilterDict] =
    useState<{}>({});
  const [small_cap_us_stocksFilterDict, setSmall_cap_us_stocksFilterDict] =
    useState<{}>({});
  const [
    non_us_developed_market_stocksFilterDict,
    setNon_us_developed_market_stocksFilterDict,
  ] = useState<{}>({});
  const [
    non_us_emerging_market_stocksFilterDict,
    setNon_us_emerging_market_stocksFilterDict,
  ] = useState<{}>({});

  const [portfolioComposition, setPortfolioComposition] = useState<{
    [key: string]: any;
  }>({});
  const [portfolioCompositionForReRender, setPortfolioCompositionForReRender] =
    useState<{
      [key: string]: any;
    }>({});
  const unexpandableCategories = [
    "long_term_bond",
    "intermediate_term_bond",
    "gold",
  ];

  const topN = 3;
  const queriesForAllWeather: queriesObj[] = [
    {
      wording: "Long Term Bond (40%)",
      category: "long_term_bond",
      setStateMethod: setLongTermBond,
      state: longTermBond,
      setUniqueQueryTokens: setLongTermBondFilterDict,
      uniqueQueryTokens: longTermBondFilterDict,
    },
    {
      wording: "Intermediate Term Bond (15%)",
      category: "intermediate_term_bond",
      setStateMethod: setIntermediateTermBond,
      state: intermediateTermBond,
      setUniqueQueryTokens: setIntermediateTermBondFilterDict,
      uniqueQueryTokens: intermediateTermBondFilterDict,
    },
    {
      wording: "Gold (7.5%)",
      category: "gold",
      setStateMethod: setGoldData,
      state: goldData,
      setUniqueQueryTokens: setGoldDataFilterDict,
      uniqueQueryTokens: goldDataFilterDict,
    },
    {
      wording: "Commodities (7.5%)",
      category: "commodities",
      setStateMethod: setCommodities,
      state: commodities,
      setUniqueQueryTokens: setCommoditiesFilterDict,
      uniqueQueryTokens: commoditiesFilterDict,
    },
    {
      wording: "Large Cap US Stocks (18%)",
      category: "large_cap_us_stocks",
      setStateMethod: set_large_cap_us_stocks,
      state: large_cap_us_stocks,
      setUniqueQueryTokens: setLarge_cap_us_stocksFilterDict,
      uniqueQueryTokens: large_cap_us_stocksFilterDict,
    },
    {
      wording: "Small Cap US Stocks (3%)",
      category: "small_cap_us_stocks",
      setStateMethod: set_small_cap_us_stocks,
      state: small_cap_us_stocks,
      setUniqueQueryTokens: setSmall_cap_us_stocksFilterDict,
      uniqueQueryTokens: small_cap_us_stocksFilterDict,
    },
    {
      wording: "Non US Developed Market Stocks (6%)",
      category: "non_us_developed_market_stocks",
      setStateMethod: set_non_us_developed_market_stocks,
      state: non_us_developed_market_stocks,
      setUniqueQueryTokens: setNon_us_developed_market_stocksFilterDict,
      uniqueQueryTokens: non_us_developed_market_stocksFilterDict,
    },
    {
      wording: "Non US Emerging Market Stocks (3%)",
      category: "non_us_emerging_market_stocks",
      setStateMethod: set_non_us_emerging_market_stocks,
      state: non_us_emerging_market_stocks,
      setUniqueQueryTokens: setNon_us_emerging_market_stocksFilterDict,
      uniqueQueryTokens: non_us_emerging_market_stocksFilterDict,
    },
  ];

  const uniqueTokens = new Set();
  queriesForAllWeather.forEach((item) => {
    // @ts-ignore
    item.uniqueQueryTokens.forEach((query: string) => {
      uniqueTokens.add(query);
    });
  });

  useEffect(() => {
    const fetchDefaultPools = async () => {
      try {
        for (const categoryMetaData of Object.values(queriesForAllWeather)) {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/all_weather_pools`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                user_api_key: userApiKey,
                category: categoryMetaData.category,
                top_n: topN,
              }),
            },
          );
          const json = await response.json();
          if (json.data.length === 0) {
            continue;
          }
          categoryMetaData.setStateMethod(json.data);
          categoryMetaData.setUniqueQueryTokens(json.unique_query_tokens);
        }
      } catch (error) {
        console.log("failed to fetch pool data", error);
      }
    };

    fetchDefaultPools();
  }, []);

  const expandedRowRender = (records: Pools) => {
    const columns = [
      columnMapping["chain"],
      columnMapping["pool"],
      columnMapping["tokens"],
      columnMapping["tvlUsd"],
      columnMapping["apr"],
    ];
    return (
      <Table
        columns={columns}
        dataSource={records.data}
        pagination={false}
        rowSelection={{
          onSelect: onSelectCallback,
        }}
      />
    );
  };
  const onSelectCallback = (record: Pool, selected: boolean) => {
    const originalPoolsCount =
      portfolioComposition[record.category_from_request] === undefined
        ? 0
        : Object.values(portfolioComposition[record.category_from_request])
            .length;
    if (selected === true) {
      const categoryPools = _getOrCreate(
        portfolioComposition,
        record.category_from_request,
      );
      categoryPools[record.pool.poolID] = record;
      portfolioComposition[record.category_from_request] = categoryPools;
    } else {
      delete portfolioComposition[record.category_from_request][
        record.pool.poolID
      ];
    }
    for (const [poolID, pool_record] of Object.entries(
      portfolioComposition[record.category_from_request],
    )) {
      for (
        let index = 0;
        // @ts-ignore
        index < pool_record.categories.length;
        index++
      ) {
        if (poolID === record.pool.poolID) {
          // @ts-ignore
          pool_record.categories[index][1].value =
            // @ts-ignore
            (pool_record.categories[index][1].value * record.category_weight) /
            (originalPoolsCount + 1);
        } else {
          // @ts-ignore
          pool_record.categories[index][1].value =
            // @ts-ignore
            (pool_record.categories[index][1].value * originalPoolsCount) /
            (originalPoolsCount + 1);
        }
      }
      portfolioComposition[record.category_from_request][poolID] = pool_record;
    }
    setPortfolioComposition(portfolioComposition);
  };

  function _getOrCreate(obj: { [key: string]: any }, key: string) {
    if (!obj[key]) {
      obj[key] = {};
    }
    return obj[key];
  }

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
            portfolioComposition={Object.values(
              portfolioCompositionForReRender,
            )}
          />
          <Button
            type="primary"
            onClick={() =>
              requestAnimationFrame(() => {
                // JSON.parse(JSON.stringify means deep copy
                setPortfolioCompositionForReRender(
                  JSON.parse(JSON.stringify(portfolioComposition)),
                );
              })
            }
          >
            Visualize
          </Button>
        </h2>
        <>
          {Object.values(queriesForAllWeather).map((categoryMetaData) => {
            return (
              <div key={categoryMetaData.category}>
                {" "}
                {/* Make sure to provide a unique key for each item */}
                <h2 className="ant-table-title">{categoryMetaData.wording}</h2>
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
                    // @ts-ignore
                    dataSource={categoryMetaData.state}
                    pagination={false}
                    rowSelection={{
                      // @ts-ignore
                      onSelect: onSelectCallback,
                    }}
                  />
                ) : (
                  <Table
                    columns={expandableColumns}
                    expandable={{
                      expandedRowRender,
                    }}
                    // @ts-ignore
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
