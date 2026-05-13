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
  { name: "Jan", receita: 18500, despesa: 8200 },
  { name: "Fev", receita: 22000, despesa: 9100 },
  { name: "Mar", receita: 19800, despesa: 8800 },
  { name: "Abr", receita: 24500, despesa: 10200 },
  { name: "Mai", receita: 28450, despesa: 11500 },
  { name: "Jun", receita: 26000, despesa: 10800 },
];

export default function CashFlowChart() {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#00C853" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#00C853" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorDespesa" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
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
        <Area type="monotone" dataKey="receita" stroke="#00C853" strokeWidth={2} fill="url(#colorReceita)" />
        <Area type="monotone" dataKey="despesa" stroke="#3b82f6" strokeWidth={2} fill="url(#colorDespesa)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
