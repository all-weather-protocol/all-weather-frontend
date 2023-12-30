import { Select } from "antd";
import tokens from "../pages/views/components/tokens.json";
import { fetch1InchSwapData } from "./oneInch";
import { portfolioVaults } from "./oneInch";
import axios from "axios";

const { Option } = Select;
const API_URL = process.env.NEXT_PUBLIC_API_URL;
export const employerAddresses = [
  "0xca35a10c9622febfa889410efb9b905b26221c37", // chris
  // below belongs to David
  "0x78000b0605e81ea9df54b33f72ebc61b5f5c8077",
  "0x43f94eb42b50d52aa0dfd702dc4b914597fa57c7",
  "0x7678107c4faa5e253b51f358c1be7c56df3d1014",
  "0x6bee1be193dfd753e8e24e3a980c0287302aa9aa",
  "0x692386195bd2cf22f40a54663517ac29946015a0",
  "0x038919c63aff9c932c77a0c9c9d98eabc1a4dd08",
  "0x3144b7e3a4518541aeb4cec7fc7a6dd82f05ae8b",
  "0xe4bac3e44e8080e1491c11119197d33e396ea82b",
  "0x43cd745bd5fbfc8cfd79ebc855f949abc79a1e0c",
  "0x7ee54ab0f204bb3a83df90fdd824d8b4abe93222",
  "0x13f42635a662848e2377a4a8d328610d12bb13df",
  "0xa1761fc95e8b2a1e99dfdee816f6d8f4c47e26ae",
  "0xe59473707108cd74cfcad6ed16c81e19cf680a46",
];
export const selectBefore = (handleChange, addressOrSymbol) => (
  <Select
    onChange={handleChange}
    defaultValue="0x55d398326f99059ff775485246999027b3197955"
    theme="light"
    style={{
      width: 100,
    }}
  >
    {tokens.props.pageProps.tokenList["56"].slice(0, 20).map((option) => {
      const keyAndValue =
        addressOrSymbol === "address" ? option.address : option.symbol;
      return (
        <Option key={keyAndValue} value={keyAndValue}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
            }}
          >
            <img
              src={option.logoURI2}
              width="20"
              height="20"
              alt={option.symbol}
            />
            <span
              style={{
                marginLeft: 6,
              }}
            >
              {option.symbol}
            </span>
          </div>
        </Option>
      );
    })}
  </Select>
);

export const getAggregatorData = async (
  chainID,
  amount,
  chosenToken,
  toToken,
  fromAddress,
  slippage,
) => {
  const chosenTokenFor1Inch =
    chosenToken === "0x0000000000000000000000000000000000000000"
      ? "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
      : chosenToken;
  if (chosenTokenFor1Inch.toLowerCase() === toToken.toLowerCase()) {
    return {
      apolloxAggregatorData: "",
    };
  }
  const [apolloxAggregatorData] = await Promise.all([
    fetch1InchSwapData(
      chainID,
      chosenTokenFor1Inch,
      toToken,
      amount,
      fromAddress,
      slippage,
    ),
  ]);
  return {
    apolloxAggregatorData: apolloxAggregatorData.tx.data,
  };
};

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function refreshTVLData(messageApi) {
  await axios
    .get(
      `${API_URL}/addresses?addresses=${portfolioVaults.join(
        "+",
      )}&refresh=True`,
    )
    .catch((error) =>
      messageApi.error({
        content: `${error.shortMessage}. Please report this issue to our Discord.`,
        duration: 5,
      }),
    );
}
