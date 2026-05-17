import { useEffect, useState } from "react";
import { resolveMediaUrl } from "@/lib/mediaUrl";

const sizeClass: Record<"sm" | "md" | "lg" | "xl", string> = {
  sm: "size-9 text-xs",
  md: "size-11 text-xs",
  lg: "size-12 text-sm",
  xl: "size-24 text-xl",
};

const sizePx: Record<"sm" | "md" | "lg" | "xl", number> = {
  sm: 36,
  md: 44,
  lg: 48,
  xl: 96,
};
export function Avatar({
  avatarUrl,
  handle,
  size = "md",
  className = "",
}: {
  avatarUrl?: string | null;
  /** Used for initials when there is no image. */
  handle?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const resolved = resolveMediaUrl(avatarUrl);

  useEffect(() => {
    setImageFailed(false);
  }, [avatarUrl]);

  const letter = (() => {
    const h = handle?.trim() ?? "";
    for (const ch of h) {
      if (/[a-zA-Z0-9]/.test(ch)) return ch.toUpperCase();
    }
    return "?";
  })();

  const showImage = Boolean(resolved) && !imageFailed;
  const px = sizePx[size];

  return (
    <div
      className={`relative aspect-square shrink-0 overflow-hidden rounded-full border border-border/60 bg-muted ${sizeClass[size]} ${className}`}
      aria-hidden
    >
      {showImage ? (
        <img
          src={resolved!}
          alt=""
          width={px}
          height={px}
          draggable={false}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover object-[50%_28%]"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center font-semibold text-muted-foreground">
          {letter}
        </span>
      )}
    </div>
  );
}
