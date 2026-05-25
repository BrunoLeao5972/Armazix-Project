import { useState, useCallback } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open, title, description, confirmLabel = "Remover", loading = false, onConfirm, onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={v => { if (!v && !loading) onCancel(); }}>
      <DialogContent className="rounded-2xl max-w-sm">
        <DialogHeader className="items-center text-center gap-3 pt-2">
          <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-destructive" />
          </div>
          <DialogTitle className="text-base font-bold">{title}</DialogTitle>
          {description && (
            <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="flex gap-3 mt-2">
          <Button
            variant="outline"
            className="flex-1 h-11 rounded-xl"
            onClick={onCancel}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            className="flex-1 h-11 rounded-xl font-semibold"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function useConfirmDialog() {
  const [state, setState] = useState<{
    open: boolean;
    title: string;
    description?: string;
    confirmLabel?: string;
    resolve?: (confirmed: boolean) => void;
  }>({ open: false, title: "" });

  const confirm = useCallback((title: string, description?: string, confirmLabel?: string) => {
    return new Promise<boolean>(resolve => {
      setState({ open: true, title, description, confirmLabel, resolve });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setState(s => { s.resolve?.(true); return { ...s, open: false }; });
  }, []);

  const handleCancel = useCallback(() => {
    setState(s => { s.resolve?.(false); return { ...s, open: false }; });
  }, []);

  const dialog = (
    <ConfirmDialog
      open={state.open}
      title={state.title}
      description={state.description}
      confirmLabel={state.confirmLabel}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );

  return { confirm, dialog };
}
