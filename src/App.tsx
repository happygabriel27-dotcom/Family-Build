import { Navigate, Route, Routes } from "react-router-dom";
import { AppProvider, useApp } from "./store/AppContext";
import { WebsiteProvider } from "./store/WebsiteContext";
import { DataProvider } from "./store/DataContext";
import { Sidebar } from "./components/layout/Sidebar";
import { TopBar } from "./components/layout/TopBar";
import { SignInAnnouncements } from "./components/layout/SignInAnnouncements";
import { RequireRole } from "./components/layout/RequireRole";
import { LoginPage } from "./pages/LoginPage";
import { SignUpPage } from "./pages/SignUpPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { OverviewPage } from "./pages/OverviewPage";
import { PropertiesPage } from "./pages/PropertiesPage";
import { PropertyDetailPage } from "./pages/PropertyDetailPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { ProjectDetailPage } from "./pages/ProjectDetailPage";
import { TasksPage } from "./pages/TasksPage";
import { PeoplePage } from "./pages/PeoplePage";
import { InventoryPage } from "./pages/InventoryPage";
import { PurchasingPage } from "./pages/PurchasingPage";
import { FinancePage } from "./pages/FinancePage";
import { RequestsPage } from "./pages/RequestsPage";
import { SupportInboxPage } from "./pages/SupportInboxPage";
import { AssignedTicketsPage } from "./pages/AssignedTicketsPage";
import { CustomersPage } from "./pages/CustomersPage";
import { AnnouncementsPage } from "./pages/AnnouncementsPage";
import { SuggestionsPage } from "./pages/SuggestionsPage";
import { ReportsPage } from "./pages/ReportsPage";
import { WorkReportsPage } from "./pages/WorkReportsPage";
import { MaterialsPage } from "./pages/MaterialsPage";
import { MessagesPage } from "./pages/MessagesPage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { FilesPage } from "./pages/FilesPage";
import { WebsiteManagementPage } from "./pages/WebsiteManagementPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { WikiPage } from "./pages/WikiPage";
import { WikiArticlePage } from "./pages/WikiArticlePage";
import { SettingsPage } from "./pages/SettingsPage";
import { AccountPage } from "./pages/AccountPage";
import { HelpPage } from "./pages/HelpPage";
import { NotFoundPage } from "./pages/NotFoundPage";

function ToastContainer() {
  const { toasts, dismissToast } = useApp();
  return (
    <div className="toast-container" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast ${toast.type === "success" ? "toast--success" : ""} ${toast.type === "error" ? "toast--error" : ""}`}
          onClick={() => dismissToast(toast.id)}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}

function AuthGate() {
  const { user } = useApp();

  if (!user) {
    return (
      <>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        <ToastContainer />
      </>
    );
  }

  /*
   * DataProvider mounts only for an authenticated session. Every sign-in
   * (including fresh sign-ups) re-initializes business data from the
   * service layer, so newly created accounts/people are always visible.
   */
  return (
    <DataProvider>
      <AppShell />
    </DataProvider>
  );
}

function AppShell() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <TopBar />
        <main className="page">
          <RequireRole>
            <Routes>
              <Route path="/" element={<OverviewPage />} />
              <Route path="/properties" element={<PropertiesPage />} />
              <Route path="/properties/:id" element={<PropertyDetailPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/projects/:id" element={<ProjectDetailPage />} />
              <Route path="/tasks" element={<TasksPage />} />
              <Route path="/people/managers" element={<PeoplePage kind="manager" />} />
              <Route path="/people/builders" element={<PeoplePage kind="builder" />} />
              <Route path="/people/developers" element={<PeoplePage kind="developer" />} />
              <Route path="/people/workers" element={<PeoplePage kind="worker" />} />
              <Route path="/people/customer-service" element={<PeoplePage kind="customer-service" />} />
              <Route path="/people/owners" element={<PeoplePage kind="admin" />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/purchasing" element={<PurchasingPage />} />
              <Route path="/finance" element={<FinancePage />} />
              <Route path="/requests" element={<RequestsPage kind="request" />} />
              <Route path="/problems" element={<RequestsPage kind="problem" />} />
              <Route path="/support" element={<SupportInboxPage />} />
              <Route path="/my-tickets" element={<AssignedTicketsPage />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/announcements" element={<AnnouncementsPage />} />
              <Route path="/suggestions" element={<SuggestionsPage />} />
              <Route path="/reports" element={<ReportsRouter />} />
              <Route path="/materials" element={<MaterialsPage />} />
              <Route path="/messages" element={<MessagesPage />} />
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/files" element={<FilesPage />} />
              <Route path="/website" element={<WebsiteManagementPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/wiki" element={<WikiPage />} />
              <Route path="/wiki/:articleId" element={<WikiArticlePage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/account" element={<AccountPage />} />
              <Route path="/help" element={<HelpPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </RequireRole>
        </main>
      </div>
      <ToastContainer />
      {/* Temporary, non-blocking announcements for freshly signed-in users. */}
      <SignInAnnouncements />
    </div>
  );
}

/** /reports renders analytics for Owner/Manager and field reports for Worker. */
function ReportsRouter() {
  const { user } = useApp();
  return user?.role === "worker" ? <WorkReportsPage /> : <ReportsPage />;
}

export default function App() {
  /* WebsiteProvider sits above authentication so sign-in/sign-up/
     forgot/reset pages render branding from the centralized website
     configuration — the same source as the app shell. */
  return (
    <WebsiteProvider>
      <AppProvider>
        <AuthGate />
      </AppProvider>
    </WebsiteProvider>
  );
}
