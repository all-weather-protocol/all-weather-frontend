import dynamic from "next/dynamic";
import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import ImageWithFallback from "../basicComponents/ImageWithFallback";
import { Spin } from "antd";
import flowChartEventEmitter from "../../utils/FlowChartEventEmitter";

// Dynamically import FlowDirectionGraph with SSR disabled
const FlowDirectionGraph = dynamic(
  () => import("@ant-design/graphs").then((mod) => mod.FlowDirectionGraph),
  { ssr: false },
);

// Memoize the formatTradingLoss function
const formatTradingLoss = React.memo(({ value, nodeId, stepName }) => {
  if (value === null && nodeId === stepName) return <Spin />;
  if (value === null) return null;

  const absValue = Math.abs(value);
  const isNegative = value < 0;
  const formattedValue =
    absValue < 0.01 ? "< $0.01" : `$${absValue.toFixed(2)}`;

  return (
    <span className={`text-sm ${isNegative ? "" : "text-green-500"}`}>
      {formattedValue}
    </span>
  );
});

// Memoize the SwapNode component
const SwapNode = React.memo(({ nodeData, displayTradingLoss }) => (
  <>
    <div className="flex items-center">
      <Image
        src="/projectPictures/1inch-network.webp"
        alt="1inch"
        className="inline-block"
        height={20}
        width={20}
        loading="lazy"
        quality={50}
        unoptimized={true}
      />
      <span className="mx-1">Swap</span>
      <ImageWithFallback
        token={nodeData.name.split(" to ")[0].replace("Swap ", "")}
        height={20}
        width={20}
      />
      <span className="mx-1">→</span>
      <ImageWithFallback
        token={nodeData.name.split(" to ")[1]}
        height={20}
        width={20}
      />
    </div>
    {displayTradingLoss !== null && (
      <div>
        <formatTradingLoss
          value={displayTradingLoss}
          nodeId={nodeData.id}
          stepName={nodeData.stepName}
        />
      </div>
    )}
  </>
));

// Memoize the DepositWithdrawNode component
const DepositWithdrawNode = React.memo(({ nodeData, displayTradingLoss, actionName }) => (
  <>
    <div className="flex items-center">
      <Image
        src={nodeData.imgSrc}
        alt={nodeData.name}
        className="inline-block"
        height={20}
        width={20}
        loading="lazy"
        quality={50}
        unoptimized={true}
      />
      <span className="mx-1">{actionName}</span>
      {nodeData.name
        .replace(actionName, "")
        .split("-")
        .map((token, idx) => (
          <ImageWithFallback
            key={idx}
            token={token}
            height={20}
            width={20}
            className="me-1"
          />
        ))}
    </div>
    {displayTradingLoss !== null && (
      <div>
        <formatTradingLoss
          value={displayTradingLoss}
          nodeId={nodeData.id}
          stepName={nodeData.stepName}
        />
      </div>
    )}
  </>
));

// Memoize the DefaultNode component
const DefaultNode = React.memo(({ nodeData }) => (
  <>
    <Image
      src={nodeData.imgSrc}
      alt={nodeData.name}
      className="inline-block me-1"
      height={20}
      width={20}
      loading="lazy"
      quality={50}
      unoptimized={true}
    />
    {nodeData.name}
  </>
));

const NodeContent = React.memo(({ nodeData, displayTradingLoss, stepName }) => {
  if (nodeData.name.startsWith("Swap")) {
    return <SwapNode nodeData={nodeData} displayTradingLoss={displayTradingLoss} />;
  }
  if (nodeData.name.startsWith("Deposit") || nodeData.name.startsWith("Withdraw")) {
    return (
      <DepositWithdrawNode
        nodeData={nodeData}
        displayTradingLoss={displayTradingLoss}
        actionName={nodeData.name.startsWith("Deposit") ? "Deposit" : "Withdraw"}
      />
    );
  }
  return <DefaultNode nodeData={nodeData} />;
});

// Add display names for debugging
NodeContent.displayName = 'NodeContent';
SwapNode.displayName = 'SwapNode';
DepositWithdrawNode.displayName = 'DepositWithdrawNode';
DefaultNode.displayName = 'DefaultNode';
formatTradingLoss.displayName = 'formatTradingLoss';

const UserFlowNode = React.memo(({
  nodeData,
  stepName,
  tradingLoss,
  completedSteps,
  setCompletedSteps,
  currentChain,
}) => {
  const [nodeState, setNodeState] = useState({
    isActive: false,
    tradingLoss: null,
  });

  // Memoize the update handler
  const handleNodeUpdate = useCallback((update) => {
    if (update.nodeId === nodeData.id) {
      setNodeState(prev => {
        if (prev.isActive === (update.status === "active") && 
            prev.tradingLoss === update.tradingLoss) {
          return prev;
        }
        return {
          isActive: update.status === "active",
          tradingLoss: update.tradingLoss,
        };
      });

      if (update.status === "active") {
        setCompletedSteps(prev => {
          if (prev.has(nodeData.id)) return prev;
          return new Set([...prev, nodeData.id]);
        });
      }
    }
  }, [nodeData.id, setCompletedSteps]);

  useEffect(() => {
    const unsubscribe = flowChartEventEmitter.subscribe(
      "NODE_UPDATE",
      handleNodeUpdate
    );

    const initialState = flowChartEventEmitter.getNodeState(nodeData.id);
    setNodeState({
      isActive: initialState.status === "active",
      tradingLoss: initialState.tradingLoss,
    });

    return () => unsubscribe();
  }, [nodeData.id, handleNodeUpdate]);

  const isActiveOrCompleted = useMemo(() => 
    nodeState.isActive ||
    nodeData.id === stepName ||
    completedSteps?.has(nodeData.id) ||
    currentChain.toLowerCase().replace(" one", "").replace(" mainnet", "") ===
      nodeData.id
  , [nodeState.isActive, nodeData.id, stepName, completedSteps, currentChain]);

  const displayTradingLoss = useMemo(() => 
    completedSteps?.has(nodeData.id)
      ? nodeState.tradingLoss
      : nodeData.id === stepName
      ? tradingLoss
      : null
  , [completedSteps, nodeData.id, nodeState.tradingLoss, stepName, tradingLoss]);

  const nodeClass = useMemo(() => 
    `user-flow-node bg-white duration-300 flex items-center justify-center ${
      isActiveOrCompleted ? "opacity-100" : "opacity-40"
    }`
  , [isActiveOrCompleted]);

  return (
    <div
      key={`flow-node-${nodeData.id}`}
      className={nodeClass}
    >
      <div className="user-flow-node-name flex items-center">
        <NodeContent
          nodeData={nodeData}
          displayTradingLoss={displayTradingLoss}
          stepName={stepName}
        />
      </div>
    </div>
  );
});

// Add display name for debugging
UserFlowNode.displayName = 'UserFlowNode';

// Define getGraphOptions as a regular function
const getGraphOptions = (
  data,
  stepName,
  tradingLoss,
  completedSteps,
  setCompletedSteps,
  currentChain,
) => ({
  autoFit: "view",
  data,
  node: {
    style: {
      component: (nodeData) => (
        <UserFlowNode
          nodeData={nodeData}
          stepName={stepName}
          tradingLoss={tradingLoss}
          completedSteps={completedSteps}
          setCompletedSteps={setCompletedSteps}
          currentChain={currentChain}
        />
      ),
      size: [200, 50],
    },
  },
  edge: {
    style: {
      stroke: (d) =>
        d.data.type === "split"
          ? "l(0) 0:#F04864 0.5:#7EC2F3 1:#1890FF"
          : "l(0) 0:#1890FF 0.5:#7EC2F3 1:#F04864",
      labelText: () => "",
      labelBackground: true,
    },
  },
  transforms: (prev) => [
    ...prev,
    {
      type: "map-edge-line-width",
      key: "map-edge-line-width",
      value: (d) => d.data.ratio,
      minValue: 0,
      maxValue: 1,
      minLineWidth: 1,
      maxLineWidth: 16,
    },
  ],
  layout: {
    type: "antv-dagre",
    nodesep: 10,
    ranksep: 5,
  },
});

export default function DemoFlowDirectionGraph({
  data,
  stepName,
  tradingLoss,
  currentChain,
}) {
  const [completedSteps, setCompletedSteps] = useState(new Set());

  // Memoize the options to prevent unnecessary recalculations
  const options = useMemo(() => 
    getGraphOptions(
      data,
      stepName,
      tradingLoss,
      completedSteps,
      setCompletedSteps,
      currentChain,
    ),
    [data, stepName, tradingLoss, completedSteps, currentChain]
  );

  return <FlowDirectionGraph {...options} />;
}
