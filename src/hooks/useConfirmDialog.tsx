import { useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type ConfirmOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

// A promise-based Yes/No AlertDialog: call `confirm(options)` and await the
// user's choice instead of wiring up open-state and callbacks at each call
// site. Only one confirmation can be pending at a time — fine here since
// every caller `await`s before issuing the next one.
export function useConfirmDialog() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((confirmed: boolean) => void) | null>(null);

  function confirm(next: ConfirmOptions): Promise<boolean> {
    setOptions(next);
    return new Promise((resolve) => {
      resolveRef.current = resolve;
    });
  }

  function resolveWith(confirmed: boolean) {
    resolveRef.current?.(confirmed);
    resolveRef.current = null;
    setOptions(null);
  }

  const dialog = (
    <AlertDialog open={options !== null} onOpenChange={(open) => !open && resolveWith(false)}>
      <AlertDialogContent>
        {options && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>{options.title}</AlertDialogTitle>
              <AlertDialogDescription>{options.description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => resolveWith(false)}>
                {options.cancelLabel ?? "Cancelar"}
              </AlertDialogCancel>
              <AlertDialogAction onClick={() => resolveWith(true)}>
                {options.confirmLabel ?? "Continuar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirm, dialog };
}
