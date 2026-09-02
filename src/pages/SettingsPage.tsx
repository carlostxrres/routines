import type { AppSettings } from "@shared/types";
import { CalendarDays, ListChecks, LogOut } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Field } from "@/components/forms/Field";
import { PageHeader } from "@/components/PageHeader";
import { SignInEmpty } from "@/components/SignInEmpty";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useSettings } from "@/hooks/useSettings";
import { actionColor } from "@/lib/actionColors";
import { apiClient } from "@/lib/api-client";
import { supabase } from "@/lib/supabase";

// 0=Sun..6=Sat, matching the column in app_settings.
const WEEK_DAYS = [
  { value: "1", label: "Lunes" },
  { value: "0", label: "Domingo" },
  { value: "6", label: "Sábado" },
];

const PREVIEW_SWATCHES = 8;

export function SettingsPage() {
  const { session } = useAuth();
  const { settings, refetch } = useSettings();
  const { confirm, dialog } = useConfirmDialog();
  const navigate = useNavigate();
  const [hue, setHue] = useState(30);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) setHue(settings.chartHue);
  }, [settings]);

  const timeZones = useMemo(() => Intl.supportedValuesOf("timeZone"), []);
  const swatches = useMemo(
    () => Array.from({ length: PREVIEW_SWATCHES }, (_, index) => actionColor(hue, index)),
    [hue],
  );

  async function save(patch: Partial<Pick<AppSettings, "timeZone" | "weekStartDay" | "chartHue">>) {
    setSaving(true);
    try {
      await apiClient.patch("/settings", patch);
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    const confirmed = await confirm({
      title: "¿Cerrar sesión?",
      description: "Seguirás pudiendo consultar los Rounds, pero no registrar ni editar.",
      confirmLabel: "Cerrar sesión",
    });
    if (!confirmed) return;
    await supabase.auth.signOut();
    navigate("/views");
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <PageHeader title="Ajustes" />

      <Card>
        <CardContent className="flex flex-col gap-2">
          <Button
            variant="outline"
            size="lg"
            className="justify-start"
            render={<Link to="/rounds" />}
          >
            <CalendarDays />
            Historial de Rounds
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="justify-start"
            render={<Link to="/routines" />}
          >
            <ListChecks />
            Rutinas
          </Button>
        </CardContent>
      </Card>

      {session && (
        <Card>
          <CardContent className="flex flex-col gap-4">
            <Field
              label="Zona horaria"
              hint="Las horas se guardan como instantes absolutos y se muestran en esta zona."
            >
              <Combobox
                items={timeZones}
                value={settings?.timeZone ?? null}
                onValueChange={(value) => value && save({ timeZone: value })}
              >
                <ComboboxInput aria-label="Zona horaria" placeholder="Europe/Madrid" />
                <ComboboxContent>
                  <ComboboxEmpty>Ninguna zona coincide.</ComboboxEmpty>
                  <ComboboxList>
                    {timeZones.map((zone) => (
                      <ComboboxItem key={zone} value={zone}>
                        {zone}
                      </ComboboxItem>
                    ))}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </Field>

            <Field label="La semana empieza en" htmlFor="week-start">
              <Select
                items={WEEK_DAYS}
                value={String(settings?.weekStartDay ?? 1)}
                onValueChange={(value) => value && save({ weekStartDay: Number(value) })}
              >
                <SelectTrigger id="week-start" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEK_DAYS.map((day) => (
                    <SelectItem key={day.value} value={day.value}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              label="Color base"
              htmlFor="chart-hue"
              hint="El resto de colores se derivan de este por el ángulo áureo."
            >
              <div className="flex flex-col gap-2">
                <div className="flex gap-1">
                  {swatches.map((color) => (
                    <div
                      key={color}
                      className="h-6 flex-1 rounded-sm"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <input
                  id="chart-hue"
                  type="range"
                  min={0}
                  max={359}
                  value={hue}
                  onChange={(event) => setHue(Number(event.target.value))}
                  // Committed on release rather than on every pixel of the drag.
                  onPointerUp={() => save({ chartHue: hue })}
                  onKeyUp={() => save({ chartHue: hue })}
                  className="w-full"
                />
              </div>
            </Field>

            {saving && <p className="text-sm text-muted-foreground">Guardando…</p>}
          </CardContent>
        </Card>
      )}

      {session ? (
        <Card>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">{session.user.email}</p>
            <Button variant="destructive" size="lg" className="w-full" onClick={handleSignOut}>
              <LogOut />
              Cerrar sesión
            </Button>
          </CardContent>
        </Card>
      ) : (
        <SignInEmpty description="Las preferencias y la edición requieren iniciar sesión. El historial y las rutinas se pueden consultar sin cuenta." />
      )}

      {dialog}
    </div>
  );
}
