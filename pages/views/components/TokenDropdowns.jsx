// const handleChange = (value) => {
//   console.log(`selected ${value}`);
// };
// const TokenDropdown = () => (
//   <Select
//     defaultValue="lucy"
//     style={{
//       width: 200,
//     }}
//     onChange={handleChange}
//     options={[
//       {
//         label: 'Manager',
//         options: [
//           {
//             label: 'Jack',
//             value: 'jack',
//           },
//           {
//             label: 'Lucy',
//             value: 'lucy',
//           },
//         ],
//       },
//       {
//         label: 'Engineer',
//         options: [
//           {
//             label: 'yiminghe',
//             value: 'Yiminghe',
//           },
//         ],
//       },
//     ]}
//   />
// );
// export default tokenDropdown;
import { Select } from "antd";
import Image from "next/image";
import tokens from "./tokens.json";
const { Option } = Select;

const TokenDropdown = ({ handleChange }) => (
  <Select
    onChange={handleChange}
    defaultValue="0x55d398326f99059ff775485246999027b3197955"
    theme="light"
    style={{
      width: "100px",
    }}
  >
    {tokens.props.pageProps.tokenList["56"].slice(0, 20).map((option) => (
      <Option key={option.address} value={option.address}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
          }}
        >
          <Image
            src={option.logoURI2}
            width={20}
            height={20}
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
    ))}
  </Select>
);
export default TokenDropdown;
