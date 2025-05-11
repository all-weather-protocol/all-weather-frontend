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

// Memoize the FormatTradingLoss function
const FormatTradingLoss = React.memo(({ value, nodeId, stepName }) => {
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
        <FormatTradingLoss
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
        <FormatTradingLoss
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
FormatTradingLoss.displayName = 'FormatTradingLoss';

// Add debug logging to UserFlowNode
const UserFlowNode = React.memo(({
  nodeData,
  stepName,
  tradingLoss,
  completedSteps,
  setCompletedSteps,
  currentChain,
}) => {
  // Memoize the node state to prevent unnecessary re-renders
  const [nodeState, setNodeState] = useState(() => {
    const initialState = flowChartEventEmitter.getNodeState(nodeData.id);
    return {
      isActive: initialState.status === "active",
      tradingLoss: initialState.tradingLoss,
    };
  });

  // Memoize the update handler with proper dependencies
  const handleNodeUpdate = useCallback((update) => {
    if (update.nodeId === nodeData.id) {
      setNodeState(prev => {
        // Only update if there's an actual change
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

  // Subscribe to updates only once
  useEffect(() => {
    const unsubscribe = flowChartEventEmitter.subscribe(
      "NODE_UPDATE",
      handleNodeUpdate
    );
    return () => unsubscribe();
  }, [handleNodeUpdate]);

  // Memoize computed values
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

  // Memoize the NodeContent props
  const nodeContentProps = useMemo(() => ({
    nodeData,
    displayTradingLoss,
    stepName,
  }), [nodeData, displayTradingLoss, stepName]);

  return (
    <div
      key={`flow-node-${nodeData.id}`}
      className={nodeClass}
    >
      <div className="user-flow-node-name flex items-center">
        <NodeContent {...nodeContentProps} />
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for React.memo
  return (
    prevProps.nodeData.id === nextProps.nodeData.id &&
    prevProps.stepName === nextProps.stepName &&
    prevProps.tradingLoss === nextProps.tradingLoss &&
    prevProps.currentChain === nextProps.currentChain &&
    prevProps.completedSteps?.has(prevProps.nodeData.id) === 
    nextProps.completedSteps?.has(nextProps.nodeData.id)
  );
});

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

// Memoize the FlowDirectionGraph component
const MemoizedFlowDirectionGraph = React.memo(FlowDirectionGraph);

export default function DemoFlowDirectionGraph({
  data,
  stepName,
  tradingLoss,
  currentChain,
}) {
  // Use useRef for completedSteps to prevent unnecessary re-renders
  const completedStepsRef = useRef(new Set());
  const [completedSteps, setCompletedSteps] = useState(new Set());

  // Memoize the setCompletedSteps callback
  const handleSetCompletedSteps = useCallback((newSteps) => {
    setCompletedSteps(newSteps);
    completedStepsRef.current = newSteps;
  }, []);

  // Simple node renderer without memoization
  const nodeRenderer = (nodeData) => (
    <UserFlowNode
      nodeData={nodeData}
      stepName={stepName}
      tradingLoss={tradingLoss}
      completedSteps={completedSteps}
      setCompletedSteps={handleSetCompletedSteps}
      currentChain={currentChain}
    />
  );

  // Only memoize the graph options to prevent unnecessary recalculations of the graph layout
  const options = useMemo(() => ({
    autoFit: "view",
    data,
    node: {
      style: {
        component: nodeRenderer,
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
  }), [data]); // Only depend on data since it affects the graph layout

  return <MemoizedFlowDirectionGraph {...options} />;
}
