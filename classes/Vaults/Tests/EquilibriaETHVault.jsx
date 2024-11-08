import { BasePortfolio } from "../../BasePortfolio";
import { BaseEquilibria } from "../../Pendle/BaseEquilibria";
import ReactMarkdown from "react-markdown";
export class EquilibriaETHVault extends BasePortfolio {
  constructor() {
    super(
      {
        long_term_bond: {
          arbitrum: [
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
              weight: 1,
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
  async lockUpPeriod(address) {
    // Get lockUpPeriods from all protocols
    const lockUpPeriodsPromises = this.strategy.gold.arbitrum.map(
      (protocol) => {
        if (protocol.interface.lockUpPeriod) {
          return protocol.interface.lockUpPeriod(address);
        } else {
          return Promise.resolve(0);
        }
      },
    );
    // Wait for all lockUpPeriods to resolve
    const lockUpPeriodsArray = await Promise.all(lockUpPeriodsPromises);
    // Get the maximum lockUpPeriod
    const lockUpPeriods = Math.max(...lockUpPeriodsArray);
    return lockUpPeriods;
  }
}
