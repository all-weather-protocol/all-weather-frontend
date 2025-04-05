import AcrossBridge from "./across";
import SquidBridge from "./squid";
interface BridgeInfo {
  bridge: AcrossBridge | SquidBridge;
  fee: string | null;
  isAvailable: boolean;
  error?: string;
}

async function getTheBestBridge(
  account: string,
  fromChainId: number,
  toChainId: number,
  inputToken: string,
  targetToken: string,
  inputAmount: string,
) {
  const bridges = await checkRatesBetweenBridges(
    account,
    fromChainId,
    toChainId,
    inputToken,
    targetToken,
    inputAmount,
  );

  const availableBridges = bridges.filter(
    (b) => b.isAvailable && b.fee !== null,
  );
  if (availableBridges.length === 0)
    throw new Error("No available bridges found");

  availableBridges.sort((a, b) => Number(a.fee) - Number(b.fee));

  return availableBridges[0].bridge;
}

async function checkRatesBetweenBridges(
  account: string,
  fromChainId: number,
  toChainId: number,
  inputToken: string,
  targetToken: string,
  inputAmount: string,
): Promise<BridgeInfo[]> {
  let bridges: BridgeInfo[] = [];

  // Squid
  try {
    const squid = new SquidBridge();
    await squid.init();
    const squidFeeCosts = await squid.getFeeCosts(
      account,
      fromChainId,
      toChainId,
      inputToken,
      targetToken,
      inputAmount,
    );
    bridges.push({
      bridge: squid,
      fee: squidFeeCosts ?? null,
      isAvailable: true,
    });
  } catch (error) {
    bridges.push({
      bridge: new SquidBridge(),
      fee: null,
      isAvailable: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Across
  try {
    const across = new AcrossBridge();
    await across.init();
    const acrossFeeCosts = await across.fetchFeeCosts(
      account,
      fromChainId,
      toChainId,
      inputToken,
      targetToken,
      inputAmount,
    );
    bridges.push({
      bridge: across,
      fee: acrossFeeCosts.toString(),
      isAvailable: true,
    });
  } catch (error) {
    bridges.push({
      bridge: new AcrossBridge(),
      fee: null,
      isAvailable: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return bridges;
}

export default getTheBestBridge;
