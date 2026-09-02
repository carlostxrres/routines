import { es } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { fromLegacyDate, type Temporal, toLegacyDate } from "@/lib/temporal";

// Split out of DatePicker so react-day-picker and the date-fns locale stay out
// of the initial bundle: the calendar only exists once a popover is opened,
// which never happens on the tap-through path of an ordinary round.
export default function DatePickerCalendar({
  value,
  onChange,
  isDisabled,
}: {
  value: Temporal.PlainDate | null;
  onChange: (date: Temporal.PlainDate) => void;
  isDisabled?: (date: Temporal.PlainDate) => boolean;
}) {
  return (
    <Calendar
      mode="single"
      locale={es}
      weekStartsOn={1}
      selected={value ? toLegacyDate(value) : undefined}
      defaultMonth={value ? toLegacyDate(value) : undefined}
      disabled={isDisabled ? (date) => isDisabled(fromLegacyDate(date)) : undefined}
      onSelect={(date) => {
        if (date) onChange(fromLegacyDate(date));
      }}
    />
  );
}
