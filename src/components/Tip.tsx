import type { CSSProperties, PropsWithChildren, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// A tooltip that works the same with a thumb as with a mouse.
//
// The default hover-only behaviour is useless on a phone, and this app is used
// on a phone, so the open state is driven entirely from here: hover for mice,
// tap to toggle for touch, Enter/Space for keyboards.

export function Tip({
  content,
  children,
  className,
  style,
  label,
}: PropsWithChildren<{
  content: string | ReactNode;
  className?: string;
  // The timeline draws its segments as absolutely positioned boxes, so the
  // trigger itself has to carry their geometry.
  style?: CSSProperties;
  // Accessible name, for triggers whose children are purely visual.
  label?: string;
}>) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Tapping elsewhere should dismiss it. A mouse gets this from onPointerLeave;
  // a finger has nothing equivalent, so it is wired up explicitly.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!triggerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <TooltipProvider delay={0}>
      <Tooltip open={open}>
        <TooltipTrigger
          render={
            <button
              ref={triggerRef}
              type="button"
              aria-label={label}
              className={cn("cursor-pointer", className)}
              style={style}
              // Pointer events rather than mouse + touch ones: a tap fires
              // touchstart *and* a synthetic click, so toggling on both would
              // open and immediately close the tooltip — the exact failure this
              // component exists to avoid. Hovering is gated on a real mouse.
              onPointerEnter={(event) => {
                if (event.pointerType === "mouse") setOpen(true);
              }}
              onPointerLeave={(event) => {
                if (event.pointerType === "mouse") setOpen(false);
              }}
              onClick={() => setOpen((current) => !current)}
              onBlur={() => setOpen(false)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  // Only these two: preventing the default for every key would
                  // swallow Tab and trap keyboard focus on the trigger.
                  event.preventDefault();
                  setOpen((current) => !current);
                }
                if (event.key === "Escape") setOpen(false);
              }}
            />
          }
        >
          {children}
        </TooltipTrigger>
        <TooltipContent className={content ? undefined : "hidden"}>
          <span className="inline-block">{content}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
