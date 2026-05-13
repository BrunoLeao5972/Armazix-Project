import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const data = [
  { name: "Jan", vendas: 18500 },
  { name: "Fev", vendas: 22000 },
  { name: "Mar", vendas: 19800 },
  { name: "Abr", vendas: 24500 },
  { name: "Mai", vendas: 28450 },
  { name: "Jun", vendas: 26000 },
];

export default function MonthlySalesChart() {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="colorVendas" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "12px",
            fontSize: 12,
          }}
        />
        <Area type="monotone" dataKey="vendas" stroke="var(--color-primary)" strokeWidth={2} fill="url(#colorVendas)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
