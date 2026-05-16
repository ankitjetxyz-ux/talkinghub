import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";

interface Props {
  onSend: (text: string, media?: { url: string; media_type: string }) => void;
}

export function MessageInput({ onSend }: Props) {
  const [value, setValue] = useState("");
  const [uploading, setUploading] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [value]);

  function send() {
    const text = value.trim();
    if (!text) return;
    onSend(text);
    setValue("");
  }

  async function onFileChange(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const { url, media_type } = await api.uploadMedia(file);
      onSend(value.trim(), { url, media_type });
      setValue("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="border-t border-border/60 bg-background/80 px-4 pb-4 pt-3 backdrop-blur-md">
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => void onFileChange(e.target.files?.[0])}
      />
      <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-border/60 bg-card/50 px-3 py-2 transition focus-within:border-border">
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="mb-1 rounded-md p-1.5 text-muted-foreground transition hover:text-foreground disabled:opacity-40"
          aria-label="Attach file"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path
              d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <textarea
          ref={ref}
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Message"
          disabled={uploading}
          className="flex-1 resize-none bg-transparent py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none scrollbar-hidden disabled:opacity-50"
        />

        <button
          type="button"
          onClick={send}
          disabled={!value.trim() || uploading}
          className="mb-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background transition hover:opacity-90 disabled:opacity-30"
          aria-label="Send"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
