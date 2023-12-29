import { Tag, Image, Modal, Button } from "antd";
import { UnlockOutlined } from "@ant-design/icons";

const showModal = (record) => {
  Modal.info({
    title: "Pro Feature",
    content: (
      <div>
        <p>
          This feature is available for Pro users. Upgrade now to access{" "}
          {record.proFeature}.
        </p>
      </div>
    ),
    onOk() {},
  });
};

export const getColumnsForSuggestionsTable = (portfolioAPR) => [
  {
    title: "Chain",
    dataIndex: "chain",
    key: "chain",
    width: 24,
    render: (chain) => (
      <Image
        src={
          chain === "fvm"
            ? `/chainPictures/fvm.png`
            : `/chainPictures/${chain.toLowerCase()}.svg`
        }
        height={20}
        width={20}
      />
    ),
  },
  {
    title: "Pool",
    dataIndex: "pool",
    key: "pool",
    width: 24,
    render: (text, record) => {
      return record.key !== "1" ? (
        <span style={{ color: "#ffffff" }}>{text}</span>
      ) : (
        <Button
          type="primary"
          icon={<UnlockOutlined />}
          onClick={() => showModal(record)}
        >
          30 Days Free Trial
        </Button>
      );
    },
  },
  {
    title: "Coin",
    dataIndex: "coin",
    key: "coin",
    width: 24,
    render: (coins) => {
      let newCoins = coins;
      if (typeof coins === "string") {
        newCoins = coins.split("-");
      }
      return (
        <div>
          {newCoins.map((coin, index) => (
            <Image
              key={index}
              src={`/tokenPictures/${coin}.png`}
              alt={coin}
              height={20}
              width={20}
            />
          ))}
        </div>
      );
    },
  },
  {
    title: "TVL",
    key: "tvlUsd",
    dataIndex: "tvlUsd",
    width: 14,
    render: (tvlUsd) => {
      let color = tvlUsd < 500000 ? "volcano" : "green";
      return (
        <Tag color={color} key={tvlUsd}>
          {(tvlUsd / 1e6).toFixed(2)}M
        </Tag>
      );
    },
  },
  {
    title: "APR",
    key: "apr",
    dataIndex: "apr",
    width: 14,
    render: (apr) => {
      let color = apr < portfolioAPR / 100 ? "volcano" : "green";
      return (
        <>
          <Tag color={color} key={apr}>
            {(apr * 100).toFixed(2)}%
          </Tag>
        </>
      );
    },
  },
];
