import { ChartNoAxesColumn } from "lucide-react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useRoutines } from "@/hooks/useRoutines";
import { isRoutineCurrent } from "@/lib/schedule";
import { today } from "@/lib/temporal";
import { getView, VIEWS } from "@/views/registry";

export function ViewsPage() {
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();
  const { routines, error } = useRoutines();
  const [routineId, setRoutineId] = useState<string | null>(null);

  const view = getView(slug) ?? VIEWS[0];

  // Routines still in use come first: those are the ones worth charting.
  const ordered = useMemo(() => {
    if (!routines) return [];
    const now = today();
    return [...routines].sort((a, b) => {
      const currentA = isRoutineCurrent(a, now);
      const currentB = isRoutineCurrent(b, now);
      if (currentA !== currentB) return currentA ? -1 : 1;
      return a.name.localeCompare(b.name, "es");
    });
  }, [routines]);

  useEffect(() => {
    if (routineId && ordered.some((routine) => routine.id === routineId)) return;
    setRoutineId(ordered[0]?.id ?? null);
  }, [ordered, routineId]);

  const routine = ordered.find((item) => item.id === routineId) ?? null;
  const ViewComponent = view.component;

  return (
    <div className="flex flex-col gap-4 p-4">
      <PageHeader title={view.name} description={view.description} />

      {error && <p className="text-sm text-destructive">{error}</p>}
      {routines === null && !error && <Skeleton className="h-72 w-full" />}

      {routines?.length === 0 && (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ChartNoAxesColumn />
            </EmptyMedia>
            <EmptyTitle>Nada que mostrar todavía</EmptyTitle>
            <EmptyDescription>
              Crea una rutina y registra algún Round para ver los gráficos.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button render={<Link to="/routines/new" />}>Crear una rutina</Button>
          </EmptyContent>
        </Empty>
      )}

      {routine && (
        <>
          <Card>
            <CardContent className="flex gap-2">
              <Select
                items={ordered.map((item) => ({ value: item.id, label: item.name }))}
                value={routineId}
                onValueChange={(value) => setRoutineId(value)}
              >
                <SelectTrigger className="flex-1" aria-label="Rutina">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ordered.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                items={VIEWS.map((item) => ({ value: item.slug, label: item.name }))}
                value={view.slug}
                onValueChange={(value) => value && navigate(`/views/${value}`)}
              >
                <SelectTrigger className="flex-1" aria-label="Vista">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VIEWS.map((item) => (
                    <SelectItem key={item.slug} value={item.slug}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Suspense fallback={<Skeleton className="h-72 w-full" />}>
            <ViewComponent routine={routine} />
          </Suspense>
        </>
      )}
    </div>
  );
}
