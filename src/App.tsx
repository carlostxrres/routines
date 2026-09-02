import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/hooks/useAuth";
import { SettingsProvider } from "@/hooks/useSettings";
import { LoginPage } from "@/pages/LoginPage";
import { RoundPage } from "@/pages/RoundPage";
import { RoundsPage } from "@/pages/RoundsPage";
import { RoutinePage } from "@/pages/RoutinePage";
import { RoutinesPage } from "@/pages/RoutinesPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { ViewsPage } from "@/pages/ViewsPage";

function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<Navigate to="/views" replace />} />
              <Route path="/views" element={<ViewsPage />} />
              <Route path="/views/:slug" element={<ViewsPage />} />
              <Route path="/rounds" element={<RoundsPage />} />
              <Route path="/routines" element={<RoutinesPage />} />
              {/* No route is auth-gated. Reading is public, and the pages that
                  need a session render a sign-in prompt in place (SignInEmpty)
                  rather than redirecting: a shared link should never dead-end
                  on a login form, whichever page it points at. */}
              <Route path="/rounds/new" element={<RoundPage />} />
              <Route path="/rounds/:id" element={<RoundPage />} />
              <Route path="/routines/new" element={<RoutinePage />} />
              <Route path="/routines/:id" element={<RoutinePage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster />
      </SettingsProvider>
    </AuthProvider>
  );
}

export default App;
