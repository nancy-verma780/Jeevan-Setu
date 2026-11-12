import { lazy, Suspense, type ReactNode } from "react";
import { useMe } from "@/features/auth/useMe";
import { LiveContext, useLiveUpdates } from "@/lib/hooks/useLiveUpdates";
import { Navigate, Route, Routes } from "react-router-dom";
import { Skeleton } from "@/components/ui/Skeleton";
import { CitizenLoginPage } from "@/features/auth/CitizenLoginPage";
import { RequireRole } from "@/features/auth/RequireRole";
import { FirstAidPage } from "@/features/citizen/FirstAidPage";
import { HomePage } from "@/features/citizen/HomePage";
import { NearbyHospitalsPage } from "@/features/citizen/NearbyHospitalsPage";
import { PassportPage } from "@/features/citizen/PassportPage";
import { DisplayPage } from "@/features/citizen/DisplayPage";
import { ComingSoonPage } from "@/features/public/ComingSoonPage";
import { ScorecardPage } from "@/features/public/ScorecardPage";
import { TrackPage } from "@/features/public/TrackPage";
import { ReportPage } from "@/features/citizen/report/ReportPage";
import { StatusPage } from "@/features/citizen/status/StatusPage";
import { DemoPage } from "@/features/demo/DemoPage";
import { DrillResultPage } from "@/features/drill/DrillResultPage";

// Staff and admin screens are loaded on demand so the citizen app stays small on slow phones.
const StaffLoginPage = lazy(() => import("@/features/auth/StaffLoginPage").then((m) => ({ default: m.StaffLoginPage })));
const IncomingPage = lazy(() => import("@/features/staff/IncomingPage").then((m) => ({ default: m.IncomingPage })));
const AdminPage = lazy(() => import("@/features/admin/AdminPage").then((m) => ({ default: m.AdminPage })));
const CaseReportPage = lazy(() => import("@/features/admin/CaseReportPage").then((m) => ({ default: m.CaseReportPage })));

function Deferred({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div role="status" aria-busy="true" className="flex flex-col gap-4 p-6">
          <Skeleton className="h-10 w-1/3" />
          <Skeleton className="h-28" />
          <Skeleton className="h-64" />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

export function App() {
  const me = useMe();
  const live = useLiveUpdates(Boolean(me.data));
  return (
    <LiveContext.Provider value={live}>
    <Routes>
      <Route path="/demo" element={<DemoPage />} />
      <Route path="/login" element={<CitizenLoginPage />} />
      <Route path="/first-aid" element={<FirstAidPage />} />
      <Route path="/" element={<RequireRole role="citizen"><HomePage /></RequireRole>} />
      <Route path="/report" element={<RequireRole role="citizen"><ReportPage /></RequireRole>} />
      <Route path="/hospitals" element={<RequireRole role="citizen"><NearbyHospitalsPage /></RequireRole>} />
      <Route path="/requests/:id" element={<RequireRole role="citizen"><StatusPage /></RequireRole>} />
      <Route path="/drill/result" element={<RequireRole role="citizen"><DrillResultPage /></RequireRole>} />
      <Route path="/staff/login" element={<Deferred><StaffLoginPage /></Deferred>} />
      <Route path="/staff" element={<RequireRole role="staff"><Deferred><IncomingPage /></Deferred></RequireRole>} />
      <Route path="/admin" element={<RequireRole role="admin"><Deferred><AdminPage /></Deferred></RequireRole>} />
      <Route path="/display" element={<RequireRole role="citizen"><DisplayPage /></RequireRole>} />
      <Route path="/passport" element={<RequireRole role="citizen"><PassportPage /></RequireRole>} />
      <Route path="/track/:token" element={<TrackPage />} />
      <Route path="/scorecard" element={<ScorecardPage />} />
      <Route path="/coming-soon" element={<ComingSoonPage />} />
      <Route path="/staff/cases/:assignmentId" element={<RequireRole role="staff"><Deferred><IncomingPage /></Deferred></RequireRole>} />
      <Route path="/admin/requests/:id/report" element={<RequireRole role="admin"><Deferred><CaseReportPage /></Deferred></RequireRole>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </LiveContext.Provider>
  );
}
