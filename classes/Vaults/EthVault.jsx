import { BasePortfolio } from "../BasePortfolio";
import { BaseEquilibria } from "../Pendle/BaseEquilibria";
import { BaseConvex } from "../Convex/BaseConvex";
import { BaseAerodrome } from "../Aerodrome/BaseAerodrome";
export class EthVault extends BasePortfolio {
  constructor() {
    super(
      {
        long_term_bond: {
          arbitrum: [
            {
              interface: new BaseEquilibria(
                "arbitrum",
                42161,
                ["pt rseth 26dec2024", "rseth"],
                "single",
                {
                  assetAddress: "0xcB471665BF23B2Ac6196D84D947490fd5571215f",
                  symbolOfBestTokenToZapOut: "weth",
                  bestTokenAddressToZapOut:
                    "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
                  decimalOfBestTokenToZapOut: 18,
                  pidOfEquilibria: 47,
                },
              ),
              weight: 0,
            },
            {
              interface: new BaseEquilibria(
                "arbitrum",
                42161,
                ["pt bedrock unieth 26dec2024", "unieth"],
                "single",
                {
                  assetAddress: "0x279b44E48226d40Ec389129061cb0B56C5c09e46",
                  symbolOfBestTokenToZapOut: "weth",
                  bestTokenAddressToZapOut:
                    "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
                  decimalOfBestTokenToZapOut: 18,
                  pidOfEquilibria: 44,
                },
              ),
              weight: 0.1,
            },
            {
              interface: new BaseConvex(
                "arbitrum",
                42161,
                ["zuneth", "weth"],
                "LP",
                {
                  pid: 28,
                  assetDecimals: 18,
                  assetAddress: "0xEBEEC2EDbbc66eB9055fe772b154f34d3dd686C8",
                  protocolAddress: "0xEBEEC2EDbbc66eB9055fe772b154f34d3dd686C8",
                  convexRewardPool:
                    "0x3708CFD102799F71DE70aeB9cbBE3A3b10529607",
                  lpTokens: [
                    [
                      "zuneth",
                      "0x06d65ec13465ac5a4376dc101e1141252c4addf8",
                      18,
                    ],
                    ["weth", "0x82af49447d8a07e3bd95bd0d56f35241523fbab1", 18],
                  ],
                  rewards: [
                    {
                      symbol: "crv",
                      coinmarketcapApiId: 6538,
                      address: "0x11cDb42B0EB46D95f990BeDD4695A6e3fA034978",
                      decimals: 18,
                    },
                    {
                      symbol: "cvx",
                      coinmarketcapApiId: 9903,
                      address: "0xaAFcFD42c9954C6689ef1901e03db742520829c5",
                      decimals: 18,
                    },
                    {
                      symbol: "zuneth",
                      coinmarketcapApiId: 1027,
                      address: "0x06D65eC13465Ac5A4376dc101e1141252c4adDf8",
                      decimals: 18,
                    },
                  ],
                },
              ),
              weight: 0.1,
            },
          ],
          base: [
            {
              interface: new BaseAerodrome(
                "base",
                8453,
                ["weth", "mseth"],
                "LP",
                {
                  assetAddress: "0xDE4FB30cCC2f1210FcE2c8aD66410C586C8D1f9A",
                  assetDecimals: 18,
                  guageAddress: "0x62940D9643a130b80CA0f8bc7e94De5b7ec496C5",
                  lpTokens: [
                    ["weth", "0x4200000000000000000000000000000000000006", 18],
                    ["mseth", "0x7Ba6F01772924a82D9626c126347A28299E98c98", 18],
                  ],
                },
              ),
              weight: 0.8,
            },
          ],
        },
      },
      {
        long_term_bond: 1,
      },
    );
    this.validateStrategyWeights();
  }
  denomination() {
    return "Ξ";
  }
}
