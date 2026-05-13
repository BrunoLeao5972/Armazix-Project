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
  { name: "Seg", entrada: 80, saida: 45 },
  { name: "Ter", entrada: 50, saida: 30 },
  { name: "Qua", entrada: 70, saida: 55 },
  { name: "Qui", entrada: 90, saida: 40 },
  { name: "Sex", entrada: 60, saida: 50 },
  { name: "Sáb", entrada: 40, saida: 65 },
  { name: "Dom", entrada: 30, saida: 25 },
];

export default function StockMovementChart() {
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
        <Bar dataKey="entrada" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="saida" fill="#3b82f6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
