"use client";

import { useRef, useTransition } from "react";
import { uploadMenuItemPhoto } from "@/app/actions/menus";
import { useToast } from "@/components/ui/toast";
import { Camera } from "lucide-react";

interface PhotoUploadButtonProps {
  menuItemId: string;
  currentPhotoUrl: string | null;
  onUpload: (url: string) => void;
}

export function PhotoUploadButton({ menuItemId, currentPhotoUrl, onUpload }: PhotoUploadButtonProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("menuItemId", menuItemId);
    formData.append("file", file);

    startTransition(async () => {
      const result = await uploadMenuItemPhoto(formData);
      if (result.ok) {
        onUpload(result.data.photo_url);
        toast("Foto actualizada", "success");
      } else {
        toast(result.error || "Error al subir foto", "error");
      }
      if (fileRef.current) fileRef.current.value = "";
    });
  };

  return (
    <div className="flex items-center gap-1.5">
      {currentPhotoUrl && (
        <img
          src={currentPhotoUrl}
          alt=""
          className="w-8 h-8 rounded object-cover border border-border flex-shrink-0"
        />
      )}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={isPending}
        className="flex items-center gap-1 px-1.5 py-1 rounded text-xs text-text-secondary hover:bg-surface-hover disabled:opacity-50 transition-colors"
        title={currentPhotoUrl ? "Cambiar foto" : "Agregar foto"}
      >
        <Camera className="h-3.5 w-3.5" />
        {isPending ? "…" : currentPhotoUrl ? "" : "Foto"}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}
