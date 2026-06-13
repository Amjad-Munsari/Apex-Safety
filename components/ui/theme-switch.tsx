"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { flushSync } from "react-dom";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const ThemeSwitch = ({
  className,
  size = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { size?: "default" | "sm" }) => {
  const sm = size === "sm";
  const { resolvedTheme, setTheme } = useTheme();
  const [checked, setChecked] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => setChecked(resolvedTheme === "dark"), [resolvedTheme]);

  const handleCheckedChange = useCallback(
    (isChecked: boolean) => {
      const apply = () => {
        setChecked(isChecked);
        setTheme(isChecked ? "dark" : "light");
      };

      const doc = document as Document & {
        startViewTransition?: (cb: () => void) => unknown;
      };
      const reducedMotion =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      // View Transitions API: cross-fade the whole page as one GPU-composited
      // snapshot so every element flips in unison — no per-element timing skew
      // (the staggered, "buggy" look) and no repaint jank. flushSync forces
      // next-themes' class change onto <html> synchronously inside the callback
      // so the API captures the new palette. Browsers without VT fall through to
      // an instant swap + the CSS transition fallback in globals.css.
      if (doc.startViewTransition && !reducedMotion) {
        doc.startViewTransition(() => flushSync(apply));
      } else {
        apply();
      }
    },
    [setTheme],
  );

  if (!mounted) return null;

  return (
    <div
      className={cn(
        "relative flex items-center justify-center", // center the whole control
        sm ? "h-7 w-14" : "h-9 w-20", // track sized to hug the icons
        className
      )}
      {...props}
    >
      {/* The real shadcn Switch (full-size, same structure) */}
      <Switch
        checked={checked}
        onCheckedChange={handleCheckedChange}
        className={cn(
          // root (track)
          "peer absolute inset-0 h-full w-full rounded-full bg-input/50 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          // tune the default thumb size & z-index so it slides over icons
          sm ? "[&>span]:h-5 [&>span]:w-5" : "[&>span]:h-7 [&>span]:w-7",
          "[&>span]:rounded-full [&>span]:bg-background [&>span]:shadow [&>span]:z-10",
          // override default translate distances so the thumb moves across track padding + icon spacing
          "data-[state=unchecked]:[&>span]:translate-x-1",
          sm
            ? "data-[state=checked]:[&>span]:translate-x-[32px]" // 32 ≈ w-14(56) - padding - thumb(20)
            : "data-[state=checked]:[&>span]:translate-x-[44px]" // 44 ≈ w-20(80) - padding - thumb(28)
        )}
      />

      {/* Icons overlaid inside the track, perfectly centered left/right */}
      <span
        className={cn(
          "pointer-events-none absolute inset-y-0 z-0",
          sm ? "left-1.5" : "left-2",
          "flex items-center justify-center"
        )}
      >
        <SunIcon
          size={sm ? 12 : 16}
          className={cn(
            "transition-all duration-200 ease-out",
            checked ? "text-muted-foreground/70" : "text-foreground scale-110"
          )}
        />
      </span>

      <span
        className={cn(
          "pointer-events-none absolute inset-y-0 z-0",
          sm ? "right-1.5" : "right-2",
          "flex items-center justify-center"
        )}
      >
        <MoonIcon
          size={sm ? 12 : 16}
          className={cn(
            "transition-all duration-200 ease-out",
            checked ? "text-foreground scale-110" : "text-muted-foreground/70"
          )}
        />
      </span>
    </div>
  );
};

export default ThemeSwitch;
