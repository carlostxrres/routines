import { es } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDayLong, fromLegacyDate, type Temporal, toLegacyDate } from "@/lib/temporal";
import { cn } from "@/lib/utils";

// A Temporal.PlainDate-shaped wrapper around react-day-picker, which speaks
// `Date`. The conversion lives in lib/temporal.ts; nothing above this component
// ever sees a Date.
export function DatePicker({
  value,
  onChange,
  isDisabled,
  placeholder = "Elige una fecha",
  id,
  className,
}: {
  value: Temporal.PlainDate | null;
  onChange: (date: Temporal.PlainDate) => void;
  // Grey out days the caller doesn't accept — e.g. dates no plan covers.
  isDisabled?: (date: Temporal.PlainDate) => boolean;
  placeholder?: string;
  id?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            variant="outline"
            size="lg"
            className={cn("w-full justify-between font-normal", className)}
          />
        }
      >
        {value ? (
          formatDayLong(value)
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        <CalendarIcon />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={es}
          weekStartsOn={1}
          selected={value ? toLegacyDate(value) : undefined}
          defaultMonth={value ? toLegacyDate(value) : undefined}
          disabled={isDisabled ? (date) => isDisabled(fromLegacyDate(date)) : undefined}
          onSelect={(date) => {
            if (!date) return;
            onChange(fromLegacyDate(date));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
