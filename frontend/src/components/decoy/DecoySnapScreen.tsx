import {
  ChevronLeft,
  MapPin,
  MessageCircle,
  Play,
  RotateCcw,
  Search,
  UserPlus,
} from "lucide-react";

interface Props {
  onClose: () => void;
}

const customScreenshot =
  typeof import.meta.env.VITE_DECOY_IMAGE_URL === "string"
    ? import.meta.env.VITE_DECOY_IMAGE_URL.trim()
    : "";

const SNAP_YELLOW = "#FFFC00";

const friends = [
  { name: "Maya", colors: "from-pink-500 to-rose-500", streak: "🔥 12" },
  { name: "River", colors: "from-violet-500 to-indigo-500", streak: "🔥 3" },
  { name: "Noah", colors: "from-cyan-400 to-blue-500", streak: "" },
  { name: "Jules", colors: "from-amber-400 to-orange-500", streak: "🔥 28" },
];

function GhostIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M12 2C7.58 2 4 5.58 4 10c0 3.54 1.82 6.52 4.5 8.5L8 21l4-2 4 2-.5-2.5C18.18 16.52 20 13.54 20 10c0-4.42-3.58-8-8-8zm0 3a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z"
      />
    </svg>
  );
}

/** Snapchat-style camera cover screen (layout inspired; no official assets). */
export function DecoySnapScreen({ onClose }: Props) {
  if (customScreenshot) {
    return (
      <div className="relative h-full w-full bg-black">
        <button
          type="button"
          onClick={onClose}
          className="absolute left-3 top-12 z-10 rounded-full bg-black/50 p-2 text-white backdrop-blur-sm"
          aria-label="Back to chat"
        >
          <ChevronLeft className="h-7 w-7" strokeWidth={1.5} />
        </button>
        <img
          src={customScreenshot}
          alt=""
          className="h-full w-full object-cover object-top"
        />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-black text-white">
      <img
        src="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&q=80"
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/70" />

      <button
        type="button"
        onClick={onClose}
        className="absolute left-2 top-11 z-20 rounded-full p-2 text-white/90 drop-shadow-md"
        aria-label="Back to chat"
      >
        <ChevronLeft className="h-8 w-8" strokeWidth={1.75} />
      </button>

      <div className="relative z-10 flex items-center justify-between px-5 pt-3 text-[13px] font-semibold text-white drop-shadow">
        <span>9:41</span>
        <div className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-white" />
          <span className="h-2.5 w-4 rounded-sm bg-white/90" />
          <span className="ml-0.5 h-3 w-6 rounded-[3px] border border-white/70" />
        </div>
      </div>

      <div className="relative z-10 flex items-start justify-between px-3 pt-2">
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 ring-2 ring-white/40 backdrop-blur-sm"
        >
          <span className="text-lg">😊</span>
        </button>
        <div className="flex items-center gap-4 pt-1">
          <Search className="h-7 w-7 drop-shadow-lg" strokeWidth={2} />
          <UserPlus className="h-7 w-7 drop-shadow-lg" strokeWidth={2} />
        </div>
      </div>

      <div className="absolute right-2 top-[28%] z-10 flex flex-col items-center gap-4">
        {friends.map((f) => (
          <div key={f.name} className="flex flex-col items-center gap-0.5">
            <div
              className={`rounded-full bg-gradient-to-br p-[2px] ${f.colors}`}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-white">
                {f.name.slice(0, 1)}
              </div>
            </div>
            {f.streak ? (
              <span className="text-[10px] font-medium text-white drop-shadow">{f.streak}</span>
            ) : null}
          </div>
        ))}
      </div>

      <div className="absolute bottom-28 left-0 right-0 z-10 flex items-end justify-center gap-8 px-6">
        <button
          type="button"
          className="mb-2 h-11 w-11 overflow-hidden rounded-lg border-2 border-white shadow-lg"
        >
          <img
            src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=200&q=80"
            alt=""
            className="h-full w-full object-cover"
          />
        </button>

        <button
          type="button"
          className="relative flex h-[78px] w-[78px] items-center justify-center rounded-full border-[5px] border-white bg-white/10 shadow-xl"
          aria-label="Capture"
        >
          <span className="h-[62px] w-[62px] rounded-full border-[3px] border-white/90 bg-transparent" />
        </button>

        <button
          type="button"
          className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-black/30 backdrop-blur-sm"
          aria-label="Flip camera"
        >
          <RotateCcw className="h-7 w-7" strokeWidth={2} />
        </button>
      </div>

      <nav
        className="absolute bottom-0 left-0 right-0 z-10 flex items-end justify-around px-2 pb-7 pt-3"
        style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.85))" }}
      >
        <NavItem icon={<MapPin className="h-6 w-6" strokeWidth={2} />} label="Map" />
        <NavItem
          icon={<MessageCircle className="h-6 w-6" strokeWidth={2} />}
          label="Chat"
          badge={3}
        />
        <div className="flex flex-col items-center gap-0.5">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-black shadow-lg"
            style={{ backgroundColor: SNAP_YELLOW }}
          >
            <GhostIcon className="h-7 w-7 text-black" />
          </div>
        </div>
        <NavItem icon={<Play className="h-6 w-6" strokeWidth={2} />} label="Stories" active />
        <NavItem icon={<span className="text-lg leading-none">✦</span>} label="Spotlight" />
      </nav>
    </div>
  );
}

function NavItem({
  icon,
  label,
  badge,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  badge?: number;
  active?: boolean;
}) {
  return (
    <button type="button" className="relative flex flex-col items-center gap-0.5 text-white/90">
      <span className={active ? "text-white" : "text-white/75"}>{icon}</span>
      <span
        className={`text-[10px] font-medium ${active ? "text-white" : "text-white/60"}`}
      >
        {label}
      </span>
      {badge != null && badge > 0 ? (
        <span className="absolute -right-1 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
          {badge}
        </span>
      ) : null}
    </button>
  );
}
