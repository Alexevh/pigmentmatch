import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Menu } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TabItem {
  value: string;
  label: string;
  icon: LucideIcon;
}

// A tab bar that stays on ONE line: the tabs that fit are shown inline, the rest
// collapse into a burger menu at the end of the same row. The active tab is
// always kept visible (swapped forward if it would overflow). Recomputes on
// container resize and when the labels change (language).
export function ResponsiveTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: TabItem[];
  value: string;
  onChange: (v: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const measureRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const burgerMeasureRef = useRef<HTMLButtonElement>(null);
  const [visibleCount, setVisibleCount] = useState(tabs.length);
  const [menuOpen, setMenuOpen] = useState(false);

  const recompute = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const gap = 4; // matches gap-1
    const avail = wrap.clientWidth - 8; // container padding (p-1)
    const widths = tabs.map((_, i) => measureRefs.current[i]?.offsetWidth ?? 0);
    const burgerW = (burgerMeasureRef.current?.offsetWidth ?? 40) + gap;

    // Do all tabs fit without a burger?
    let total = 0;
    let all = true;
    for (let i = 0; i < tabs.length; i++) {
      total += widths[i] + (i > 0 ? gap : 0);
      if (total > avail) {
        all = false;
        break;
      }
    }
    if (all) {
      setVisibleCount(tabs.length);
      return;
    }
    // Otherwise reserve room for the burger and fit as many as possible.
    total = 0;
    let count = 0;
    for (let i = 0; i < tabs.length; i++) {
      const w = widths[i] + (i > 0 ? gap : 0);
      if (total + w + burgerW <= avail) {
        total += w;
        count++;
      } else break;
    }
    setVisibleCount(Math.max(1, count));
  }, [tabs]);

  useLayoutEffect(() => {
    recompute();
  }, [recompute]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(recompute);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [recompute]);

  // Close the menu on outside click / Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = () => setMenuOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("click", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // Split into visible / overflow, keeping the active tab visible.
  let visible = tabs.slice(0, visibleCount);
  let overflow = tabs.slice(visibleCount);
  if (overflow.some((t) => t.value === value) && visible.length > 0) {
    const active = overflow.find((t) => t.value === value)!;
    const displaced = visible[visible.length - 1];
    visible = [...visible.slice(0, -1), active];
    overflow = [displaced, ...overflow.filter((t) => t.value !== value)];
  }
  const hasOverflow = overflow.length > 0;

  const btnClass = (active: boolean) =>
    cn(
      "inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
      active
        ? "bg-background text-foreground shadow-sm"
        : "text-muted-foreground hover:text-foreground"
    );

  return (
    <div
      ref={wrapRef}
      className="relative flex items-center gap-1 rounded-lg bg-secondary/60 p-1"
    >
      {/* Hidden measuring row: every tab + a burger, to read their widths. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1 top-1 -z-10 flex gap-1 opacity-0"
      >
        {tabs.map((tab, i) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.value}
              ref={(el) => {
                measureRefs.current[i] = el;
              }}
              className={btnClass(false)}
            >
              <Icon className="h-4 w-4" /> {tab.label}
            </button>
          );
        })}
        <button ref={burgerMeasureRef} className={btnClass(false)}>
          <Menu className="h-4 w-4" />
        </button>
      </div>

      {/* Visible tabs */}
      {visible.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.value}
            onClick={() => onChange(tab.value)}
            className={btnClass(tab.value === value)}
          >
            <Icon className="h-4 w-4" /> {tab.label}
          </button>
        );
      })}

      {/* Overflow burger + menu */}
      {hasOverflow && (
        <div className="relative ml-auto">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((o) => !o);
            }}
            className={btnClass(overflow.some((t) => t.value === value))}
            aria-label="More tabs"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <Menu className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-full z-30 mt-1 min-w-44 rounded-lg border border-border bg-background p-1 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {overflow.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.value}
                    onClick={() => {
                      onChange(tab.value);
                      setMenuOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors",
                      tab.value === value
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" /> {tab.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
