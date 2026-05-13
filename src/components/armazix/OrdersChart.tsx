import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const data = [
  { name: "Seg", pedidos: 18 },
  { name: "Ter", pedidos: 25 },
  { name: "Qua", pedidos: 20 },
  { name: "Qui", pedidos: 32 },
  { name: "Sex", pedidos: 38 },
  { name: "Sáb", pedidos: 45 },
  { name: "Dom", pedidos: 28 },
];

export default function OrdersChart() {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
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
        <Bar dataKey="pedidos" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
