"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

interface ComplianceData {
  name: string;
  value: number;
  color: string;
}

interface ComplianceChartProps {
  data: ComplianceData[];
}

export function ComplianceChart({ data }: ComplianceChartProps) {
  // Calculate total and percentage for the center text
  const total = data.reduce((acc, curr) => acc + curr.value, 0);
  const currentVal = data.find(d => d.name === 'Current')?.value || 0;
  const percentage = total > 0 ? Math.round((currentVal / total) * 100) : 0;

  return (
    <div className="flex-1 relative flex items-center justify-center">
      <div className="w-full h-full min-h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={80}
              outerRadius={100}
              stroke="none"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="font-serif text-4xl text-white">{percentage}%</div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-[#888] mt-1">Current</div>
      </div>
    </div>
  );
}
