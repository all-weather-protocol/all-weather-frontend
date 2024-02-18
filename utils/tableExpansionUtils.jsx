import { Tag, Image, Button, Badge, Tooltip } from "antd";
import {
  UnlockOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from "@ant-design/icons";

// TODO: need to implement the paid button
const paidUserWallets = [
  "0x78000b0605E81ea9df54b33f72ebC61B5F5c8077",
  "0x3144b7E3a4518541AEB4ceC7fC7A6Dd82f05Ae8B",
  "0xa1761fc95E8B2A1E99dfdEE816F6D8F4c47e26AE",
  "0xCa35a10C9622fEBfA889410Efb9B905B26221c37", // Chris
  "0xA1abE1Ee3Bd158CF4468434485c6a0E21A7eE83D", // Adrian
];
export const columnMapping = (walletAddress) => ({
  chain: {
    title: "Chain",
    dataIndex: "chain",
    key: "chain",
    width: 24,
    render: (chain) => (
      <Image src={`/chainPicturesWebp/${chain}.webp`} height={20} width={20} />
    ),
  },
  pool: {
    title: "Pool",
    dataIndex: "pool",
    key: "pool",
    width: 24,
    render: (pool, _, index) => {
      return index === 0 && !paidUserWallets.includes(walletAddress) ? (
        <Button type="primary" icon={<UnlockOutlined />}>
          30 Days Free Trial
        </Button>
      ) : (
        <>
          <Image
            src={`/projectPictures/${pool.name}.webp`}
            alt={pool.name}
            height={20}
            width={20}
          />
          <Tooltip title={"pool ID: " + pool.poolID}>
            <span style={{ color: "#ffffff" }}> {pool.name}</span>
            {pool.meta ? (
              <span
                style={{
                  color: "#ffffff",
                  fontSize: "smaller",
                  opacity: "0.7",
                }}
              >
                ({pool.meta})
              </span>
            ) : null}
          </Tooltip>
        </>
      );
    },
  },
  tokens: {
    title: "Tokens",
    dataIndex: "tokens",
    key: "tokens",
    width: 24,
    render: (tokens) => {
      let newCoins = tokens;
      if (typeof tokens === "string") {
        newCoins = tokens.split("-");
      }
      return (
        <div>
          {newCoins.map((token, index) => (
            <Image
              key={index}
              src={`/tokenPictures/${token}.webp`}
              alt={token}
              height={20}
              width={20}
            />
          ))}
          {
            // backward compatibility
            Array.isArray(tokens) ? (
              <span style={{ color: "#ffffff" }}> {tokens.join("-")}</span>
            ) : (
              <span style={{ color: "#ffffff" }}> {tokens}</span>
            )
          }
        </div>
      );
    },
  },
  tvlUsd: {
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
  apr: {
    title: "APR",
    key: "apr",
    dataIndex: "apr",
    width: 14,
    render: (apr) => {
      let color = "green";
      return apr.value ? (
        <>
          <Badge
            count={
              apr.predictions.predictedClass === "Down" ? (
                <ArrowDownOutlined style={{ color: "red" }} />
              ) : (
                <ArrowUpOutlined style={{ color: "green" }} />
              )
            }
          >
            <Tag color={color} key={apr.value}>
              {apr.value.toFixed(2)}%
            </Tag>
          </Badge>
        </>
      ) : (
        // for backward compatibility
        <Tag color={color}>{apr}</Tag>
      );
    },
  },
  outerAprColumn: {
    title: "Highest APR",
    key: "apr",
    dataIndex: "apr",
    width: 14,
    render: (apr) => {
      let color = "green";
      return (
        <>
          <Tag color={color} key={apr.value}>
            {apr.value.toFixed(2)}%
          </Tag>
        </>
      );
    },
  },
});
export const getExpandableColumnsForSuggestionsTable = () => [
  columnMapping("")["tokens"],
  columnMapping("")["outerAprColumn"],
];

export const getBasicColumnsForSuggestionsTable = (walletAddress) => [
  columnMapping("")["chain"],
  columnMapping(walletAddress)["pool"],
  columnMapping("")["tokens"],
  columnMapping("")["tvlUsd"],
  columnMapping("")["apr"],
];
