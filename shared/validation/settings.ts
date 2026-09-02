import { z } from "zod";

export const settingsPatchSchema = z.object({
  // Validated against the runtime's own tz database rather than a hardcoded
  // list, so it stays correct as zones are added or renamed.
  timeZone: z
    .string()
    .refine((value) => Intl.supportedValuesOf("timeZone").includes(value), {
      message: "Zona horaria desconocida.",
    })
    .optional(),
  // 0=Sun..6=Sat.
  weekStartDay: z.int().min(0).max(6).optional(),
  chartHue: z.int().min(0).max(359).optional(),
});

export type SettingsPatch = z.infer<typeof settingsPatchSchema>;
