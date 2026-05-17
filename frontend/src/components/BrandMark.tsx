import { SITE_LOGO_SRC, SITE_NAME } from "@/lib/brand";

const logoClass =
  "object-cover object-[center_22%] ring-white/12 shadow-lg select-none pointer-events-none";

export function BrandMark({
  variant = "hero",
}: {
  variant?: "hero" | "inline" | "compact";
}) {
  if (variant === "compact") {
    return (
      <div className="flex flex-col items-center gap-3">
        <img
          src={SITE_LOGO_SRC}
          alt=""
          width={96}
          height={96}
          className={`size-24 rounded-xl sm:size-28 ${logoClass} ring-2`}
        />
        <p className="text-lg font-bold lowercase tracking-tight text-foreground">
          {SITE_NAME}
        </p>
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div className="flex items-center gap-3">
        <img
          src={SITE_LOGO_SRC}
          alt=""
          width={40}
          height={40}
          className={`size-10 shrink-0 rounded-xl ${logoClass} ring-1`}
        />
        <span className="text-base font-semibold lowercase tracking-tight text-foreground">
          {SITE_NAME}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <img
        src={SITE_LOGO_SRC}
        alt=""
        width={176}
        height={176}
        className={`size-36 max-h-[38vw] max-w-[38vw] rounded-[1.75rem] sm:size-44 ${logoClass} ring-2`}
      />
      <p className="text-xl font-bold lowercase leading-none tracking-tight text-foreground sm:text-2xl">
        {SITE_NAME}
      </p>
    </div>
  );
}
