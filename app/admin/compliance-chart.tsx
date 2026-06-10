"use client";

import dynamic from "next/dynamic";

interface ComplianceData {
  name: string;
  value: number;
  color: string;
}

interface ComplianceChartProps {
  data: ComplianceData[];
}

const ComplianceChartImpl = dynamic(
  () => import("./compliance-chart-impl").then((m) => ({ default: m.ComplianceChartImpl })),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 relative flex items-center justify-center min-h-[200px] animate-pulse">
        <div className="w-[200px] h-[200px] rounded-full border-[20px] border-[#333]" />
      </div>
    ),
  }
);

export function ComplianceChart({ data }: ComplianceChartProps) {
  // Calculate total and percentage for the center text
  const total = data.reduce((acc, curr) => acc + curr.value, 0);
  const currentVal = data.find((d) => d.name === "Current")?.value || 0;
  const percentage = total > 0 ? Math.round((currentVal / total) * 100) : 0;

  return <ComplianceChartImpl data={data} percentage={percentage} />;
}
