import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { LoginPage } from "@/features/auth/LoginPage";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { GuestDetailPage } from "@/features/guests/GuestDetailPage";
import { NodeDetailPage } from "@/features/nodes/NodeDetailPage";
import { ClustersAdminPage } from "@/features/clusters/ClustersAdminPage";
import { StoragePage } from "@/features/storage/StoragePage";
import { NetworkPage } from "@/features/network/NetworkPage";
import { BackupsPage } from "@/features/backups/BackupsPage";
import { AuditPage } from "@/features/audit/AuditPage";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="flex h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="clusters" element={<ClustersAdminPage />} />
          <Route path="storage" element={<StoragePage />} />
          <Route path="network" element={<NetworkPage />} />
          <Route path="backups" element={<BackupsPage />} />
          <Route path="audit" element={<AuditPage />} />
          <Route path="guests/:clusterId/:node/:type/:vmid" element={<GuestDetailPage />} />
          <Route path="nodes/:clusterId/:node" element={<NodeDetailPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
