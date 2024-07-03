import { AllWeatherPortfolio } from "../classes/AllWeatherPortfolio";

export function getPortfolioHelper(portfolioName: string): AllWeatherPortfolio {
  let portfolioHelper: AllWeatherPortfolio;
  if (portfolioName === "AllWeatherPortfolio") {
    portfolioHelper = new AllWeatherPortfolio();
  } else {
    console.log("portfolioName", portfolioName);
    throw new Error(`Invalid portfolio name`);
  }
  return portfolioHelper;
}
