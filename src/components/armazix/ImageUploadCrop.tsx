import Cropper, { type Area } from "react-easy-crop";
import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { UploadCloud, X } from "lucide-react";

type OutputFormat = "image/jpeg" | "image/png" | "image/webp";

async function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
    reader.readAsDataURL(file);
  });
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Erro ao carregar imagem"));
    img.crossOrigin = "anonymous";
    img.src = src;
  });
}

async function cropToBlob(opts: {
  imageSrc: string;
  crop: Area;
  targetWidth?: number;
  targetHeight?: number;
  format: OutputFormat;
  quality?: number;
}): Promise<Blob> {
  const img = await loadImage(opts.imageSrc);

  const outputWidth = opts.targetWidth ?? Math.round(opts.crop.width);
  const outputHeight = opts.targetHeight ?? Math.round(opts.crop.height);

  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas não suportado");

  ctx.drawImage(
    img,
    opts.crop.x,
    opts.crop.y,
    opts.crop.width,
    opts.crop.height,
    0,
    0,
    outputWidth,
    outputHeight
  );

  // WebP and JPEG both accept quality; PNG ignores it
  const quality = opts.format !== "image/png" ? (opts.quality ?? 0.85) : undefined;
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, opts.format, quality)
  );
  if (!blob) throw new Error("Falha ao gerar imagem final");
  return blob;
}

function approxEqualRatio(a: number, b: number): boolean {
  return Math.abs(a - b) <= 0.02;
}

export function ImageUploadCrop(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  recommendedText: string;
  aspect: number;
  targetWidth?: number;
  targetHeight?: number;
  maxBytes: number;
  outputFormat: OutputFormat;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [cropOpen, setCropOpen] = useState(false);
  const [pendingImageSrc, setPendingImageSrc] = useState<string | null>(null);
  const [pendingObjectUrl, setPendingObjectUrl] = useState<string | null>(null);

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [cropping, setCropping] = useState(false);

  const hasImage = !!props.value;

  const boxClass = useMemo(() => {
    const base =
      "relative rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors overflow-hidden";
    return base + (dragOver ? " ring-2 ring-primary/30 border-primary/40" : "");
  }, [dragOver]);

  const clearPending = () => {
    if (pendingObjectUrl) URL.revokeObjectURL(pendingObjectUrl);
    setPendingObjectUrl(null);
    setPendingImageSrc(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  };

  const openCrop = (objectUrl: string) => {
    setError(null);
    setPendingObjectUrl(objectUrl);
    setPendingImageSrc(objectUrl);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setCropOpen(true);
  };

  const handleFile = async (file: File) => {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Selecione um arquivo de imagem");
      return;
    }
    if (file.size > props.maxBytes) {
      setError("Imagem acima do limite de tamanho");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    try {
      const img = await loadImage(objectUrl);
      const ratio = img.naturalWidth / img.naturalHeight;

      const recommendedExceeds =
        (props.targetWidth ? img.naturalWidth > props.targetWidth : false) ||
        (props.targetHeight ? img.naturalHeight > props.targetHeight : false);

      if (!approxEqualRatio(ratio, props.aspect) || recommendedExceeds) {
        openCrop(objectUrl);
        return;
      }

      // Convert to the target format (including WebP) via canvas even without crop
      const blob = await cropToBlob({
        imageSrc: objectUrl,
        crop: { x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight },
        targetWidth: props.targetWidth,
        targetHeight: props.targetHeight,
        format: props.outputFormat,
        quality: 0.85,
      });
      const dataUrl = await fileToDataUrl(blob);
      props.onChange(dataUrl);
      URL.revokeObjectURL(objectUrl);
    } catch {
      URL.revokeObjectURL(objectUrl);
      setError("Não foi possível processar a imagem");
    }
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void handleFile(file);
  };

  const confirmCrop = async () => {
    if (!pendingImageSrc || !croppedAreaPixels) return;
    setCropping(true);
    setError(null);
    try {
      const blob = await cropToBlob({
        imageSrc: pendingImageSrc,
        crop: croppedAreaPixels,
        targetWidth: props.targetWidth,
        targetHeight: props.targetHeight,
        format: props.outputFormat,
        quality: 0.85,
      });
      const dataUrl = await fileToDataUrl(blob);
      props.onChange(dataUrl);
      setCropOpen(false);
      clearPending();
    } catch {
      setError("Falha ao gerar a imagem final");
    } finally {
      setCropping(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium">{props.label}</div>
        <Badge className="rounded-full bg-slate-900/5 text-slate-700 border-0 text-[10px]">
          {props.recommendedText}
        </Badge>
      </div>

      <div
        className={boxClass}
        onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        {hasImage ? (
          <>
            <img src={props.value} alt={props.label} className="w-full h-44 sm:h-48 object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/0 to-black/0 pointer-events-none" />
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
              <label className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-white/90 hover:bg-white transition-colors text-sm font-semibold cursor-pointer">
                <UploadCloud className="w-4 h-4" />
                Substituir
                <input type="file" accept="image/*" className="hidden" onChange={onPick} />
              </label>
              <Button type="button" variant="destructive" className="h-10 rounded-xl" onClick={() => props.onChange("")}>
                Remover
              </Button>
            </div>
          </>
        ) : (
          <label className="block cursor-pointer">
            <div className="px-4 py-8 flex flex-col items-center justify-center gap-2 text-center">
              <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center">
                <UploadCloud className="w-5 h-5 text-slate-500" />
              </div>
              <div className="text-sm font-semibold text-slate-700">Arraste e solte ou clique para enviar</div>
              <div className="text-xs text-slate-500">Se a proporção não bater, você ajusta no recorte</div>
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={onPick} />
          </label>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Dialog
        open={cropOpen}
        onOpenChange={(open) => {
          setCropOpen(open);
          if (!open) clearPending();
        }}
      >
        <DialogContent className="max-w-3xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-3">
              Ajustar recorte
              <button
                type="button"
                onClick={() => setCropOpen(false)}
                className="w-9 h-9 rounded-xl hover:bg-secondary flex items-center justify-center"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative w-full h-[320px] sm:h-[420px] rounded-2xl overflow-hidden bg-slate-950/90">
              {pendingImageSrc && (
                <Cropper
                  image={pendingImageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={props.aspect}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={(_, areaPixels) => setCroppedAreaPixels(areaPixels)}
                  objectFit="contain"
                />
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Zoom</span>
                <span className="text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
              </div>
              <Slider
                value={[zoom]}
                min={1}
                max={3}
                step={0.01}
                onValueChange={(v) => setZoom(v[0] ?? 1)}
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => setCropOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" className="rounded-xl bg-gradient-primary shadow-glow" disabled={cropping} onClick={confirmCrop}>
                {cropping ? "Gerando..." : "Confirmar recorte"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
