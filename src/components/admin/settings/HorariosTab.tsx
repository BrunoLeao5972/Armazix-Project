import { Check, Clock, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { StoreData } from "./types";

export type BusinessHour = { day: string; open: string; close: string; closed: boolean };

interface HorariosTabProps {
  store: StoreData | null;
  businessHours: BusinessHour[];
  setBusinessHours: (hours: BusinessHour[]) => void;
  hoursSaving: boolean;
  setHoursSaving: (v: boolean) => void;
  hoursSuccess: boolean;
  setHoursSuccess: (v: boolean) => void;
  setError: (v: string) => void;
}

export function HorariosTab({
  store, businessHours, setBusinessHours, hoursSaving, setHoursSaving, hoursSuccess, setHoursSuccess, setError,
}: HorariosTabProps) {
  return (
    <Card className="rounded-2xl border-border/50 shadow-soft">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Horário de Funcionamento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {businessHours.length === 0 && (
          <p className="text-sm text-muted-foreground">Carregando horários...</p>
        )}
        {businessHours.map((item, idx) => (
          <div key={item.day} className="flex items-center gap-3 py-2 border-b last:border-b-0">
            <span className="w-28 text-sm font-medium">{item.day}</span>
            <Switch
              checked={!item.closed}
              onCheckedChange={(checked) => {
                const updated = [...businessHours];
                updated[idx] = { ...updated[idx], closed: !checked };
                setBusinessHours(updated);
              }}
            />
            {!item.closed ? (
              <>
                <Input
                  type="time"
                  value={item.open}
                  onChange={(e) => {
                    const updated = [...businessHours];
                    updated[idx] = { ...updated[idx], open: e.target.value };
                    setBusinessHours(updated);
                  }}
                  className="h-9 rounded-lg w-28 text-sm"
                />
                <span className="text-muted-foreground">até</span>
                <Input
                  type="time"
                  value={item.close}
                  onChange={(e) => {
                    const updated = [...businessHours];
                    updated[idx] = { ...updated[idx], close: e.target.value };
                    setBusinessHours(updated);
                  }}
                  className="h-9 rounded-lg w-28 text-sm"
                />
              </>
            ) : (
              <span className="text-sm text-muted-foreground">Fechado</span>
            )}
          </div>
        ))}
        {hoursSuccess && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <Check className="w-4 h-4" />
            Horários salvos com sucesso!
          </div>
        )}
        <Button
          onClick={async () => {
            if (!store) return;
            setHoursSaving(true);
            setHoursSuccess(false);
            try {
              const res = await fetch("/api/store/update-business-hours", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ storeId: store.id, businessHours }),
              });
              const data = await res.json();
              if (res.ok) {
                setHoursSuccess(true);
              } else {
                setError(data.error || "Erro ao salvar horários");
              }
            } catch {
              setError("Erro de conexão");
            } finally {
              setHoursSaving(false);
            }
          }}
          disabled={hoursSaving}
          className="h-10 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow"
        >
          {hoursSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar horários"}
        </Button>
      </CardContent>
    </Card>
  );
}
