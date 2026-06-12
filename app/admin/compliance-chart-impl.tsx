"use client";

import { PieChart, Pie, Cell } from "recharts";

interface ComplianceData {
  name: string;
  value: number;
  color: string;
}

interface ComplianceChartImplProps {
  data: ComplianceData[];
  percentage: number;
  activeStatus?: string | null;
  onStatusEnter?: (name: string) => void;
}

// Fixed-size chart: percentage-height chains inside nested flex columns give
// recharts' ResponsiveContainer unstable (-1) measurements, so size explicitly.
const CHART_SIZE = 230;

export function ComplianceChartImpl({
  data,
  percentage,
  activeStatus,
  onStatusEnter,
}: ComplianceChartImplProps) {
  return (
    <div className="w-full h-full min-h-[200px] flex items-center justify-center">
      <div className="relative" style={{ width: CHART_SIZE, height: CHART_SIZE }}>
        <PieChart width={CHART_SIZE} height={CHART_SIZE}>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={80}
            outerRadius={100}
            stroke="none"
            dataKey="value"
            isAnimationActive={false}
            onMouseEnter={(entry) => {
              const name = (entry as { name?: string })?.name;
              if (name) onStatusEnter?.(name);
            }}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color}
                opacity={activeStatus && activeStatus !== entry.name ? 0.25 : 1}
                cursor={entry.value > 0 ? "pointer" : "default"}
              />
            ))}
          </Pie>
        </PieChart>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="font-serif text-4xl text-foreground">{percentage}%</div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-1">Current</div>
        </div>
      </div>
    </div>
  );
}
