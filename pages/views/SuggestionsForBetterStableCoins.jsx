import { ConfigProvider, Table } from "antd";
import { useState, useEffect } from "react";
import { getColumnsForSuggestionsTable } from "../../utils/tableExpansionUtils";

export default function SuggestionsForBetterStableCoins(props) {
  const { wording, topNData } = props;
  const [data, setData] = useState([]);
  const commonColumns = getColumnsForSuggestionsTable();

  useEffect(() => {
    if (topNData) {
      let extractedData = topNData.map((metadata, idx) => ({
        key: idx,
        chain: metadata.chain,
        pool: metadata.project,
        coin: metadata.symbol,
        tvl: metadata.tvlUsd / 1e6,
        apr: ((metadata.apy / 100 + 1) ** (1 / 365) - 1) * 365,
      }));
      if (extractedData.length === 0) {
        extractedData = [
          {
            key: 1,
            chain: "",
            pool: "",
            coin: (
              <span style={{ color: "#ffffff" }}>
                Your Current Pool is the best one
              </span>
            ),
            tvl: 0,
            apr: "",
          },
        ];
      }
      setData(extractedData);
    }
  }, [topNData]);

  return (
    <div>
      <h2 className="ant-table-title">{wording}:</h2>
      <ConfigProvider
        theme={{
          token: {
            colorBgContainer: "#000000",
            colorBorderSecondary: "#000000",
            colorFillAlter: "#5DFDCB",
            colorText: "#000000",
            colorPrimary: "#5DFDCB",
          },
        }}
      >
        <Table
          columns={commonColumns}
          dataSource={data}
          pagination={false}
          scroll={{
            x: 600,
            y: props.windowHeight,
          }}
        />
      </ConfigProvider>
    </div>
  );
}
