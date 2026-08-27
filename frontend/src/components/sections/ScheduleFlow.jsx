import { useMemo } from "react";
import { ReactFlow, Background, Controls, Handle, Position } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { fest } from "../../content/fest.js";

// One lane per day, laid out left to right in time order.
const COL_W = 260;
const ROW_H = 190;
const X0 = 40;
const Y0 = 40;

function DayNode({ data }) {
  return (
    <div className="flow-day">
      <strong>{data.day}</strong>
      <span>{data.date}</span>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function SlotNode({ data }) {
  return (
    <div className="flow-slot">
      <span className="flow-time">{data.time}</span>
      <h4>{data.title}</h4>
      <p>{data.venue}</p>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = { day: DayNode, slot: SlotNode };

function buildGraph(days) {
  const nodes = [];
  const edges = [];

  days.forEach((day, row) => {
    const y = Y0 + row * ROW_H;
    const dayId = `day-${row}`;

    nodes.push({
      id: dayId,
      type: "day",
      position: { x: X0, y },
      data: { day: day.day, date: day.date },
      draggable: false,
    });

    day.items.forEach((item, i) => {
      const id = `${dayId}-slot-${i}`;
      nodes.push({
        id,
        type: "slot",
        position: { x: X0 + (i + 1) * COL_W, y },
        data: item,
        draggable: false,
      });

      // Chain each slot to the one before it, so the lane reads as a timeline.
      edges.push({
        id: `${id}-edge`,
        source: i === 0 ? dayId : `${dayId}-slot-${i - 1}`,
        target: id,
        animated: true,
      });
    });
  });

  return { nodes, edges };
}

export default function ScheduleFlow() {
  const { nodes, edges } = useMemo(() => buildGraph(fest.schedule), []);

  return (
    <div className="schedule-flow">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        nodesConnectable={false}
        // The section scrolls; let the page keep the wheel and pan with drag.
        zoomOnScroll={false}
        preventScrolling={false}
        panOnDrag
      >
        <Background gap={22} size={1.5} color="#c3ccdd" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
