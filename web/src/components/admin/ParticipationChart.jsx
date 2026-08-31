"use client";

import { Chart, ArcElement, Tooltip, Legend } from "chart.js";
import { Pie } from "react-chartjs-2";

Chart.register(ArcElement, Tooltip, Legend);

// Fixed categorical order (dataviz reference palette, light mode). Assigned in
// order, never cycled — with 8 events this is the whole set.
const SLICE_COLORS = [
  "#2a78d6", "#eb6834", "#1baf7a", "#eda100",
  "#e87ba4", "#008300", "#4a3aa7", "#e34948",
];

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

/**
 * Participation-by-event pie. `data` is buildStats().per_event —
 * `[{ event_id, name, count, completed, revenue }]`, already sorted.
 * Slices are keyed on completed registrations; the legend + tooltip carry
 * identity so it never rests on colour alone.
 */
export default function ParticipationChart({ data }) {
  const chartData = {
    labels: data.map((e) => e.name),
    datasets: [
      {
        data: data.map((e) => e.completed),
        backgroundColor: data.map((_, i) => SLICE_COLORS[i % SLICE_COLORS.length]),
        borderColor: "#ffffff",
        borderWidth: 2,
        hoverOffset: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: { boxWidth: 12, boxHeight: 12, padding: 14 },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const row = data[ctx.dataIndex];
            return ` ${row.completed} completed · ${inr(row.revenue)}`;
          },
        },
      },
    },
  };

  return (
    <div className="participation-chart">
      <Pie data={chartData} options={options} />
    </div>
  );
}
