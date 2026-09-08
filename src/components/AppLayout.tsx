import { Outlet } from "react-router-dom";
import { BottomTabBar } from "@/components/BottomTabBar";

export function AppLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      {/* pb-16 clears the fixed tab bar; the bar adds the safe-area inset itself. */}
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col pb-[calc(4rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>
      <BottomTabBar />
    </div>
  );
}
