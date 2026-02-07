import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LandingPage } from "./components/LandingPage";
import { LoginPage } from "./components/LoginPage";
import { SignupPage } from "./components/SignupPage";
import { Sidebar } from "./components/Sidebar";
import { PressMachineDashboard } from "./components/PressMachineDashboard";
import { WindShieldDashboard } from "./components/WindShieldDashboard";
import { EngineVibrationDashboard } from "./components/EngineVibrationDashboard";
import { WeldingImageDashboard } from "./components/WeldingImageDashboard";
import { BodyAssemblyDashboard } from "./components/BodyAssemblyDashboard";
import { PaintQualityDashboard } from "./components/PaintQualityDashboard";
import { MainDashboard } from "./components/MainDashboard";
import { AIChatbot } from "./components/AIChatbot";
import { BoardListPage } from "./components/Board/BoardListPage";
import { BoardWritePage } from "./components/Board/BoardWritePage";
import { BoardDetailPage } from "./components/Board/BoardDetailPage";
import { OrderPage } from "./components/order/OrderPage";
import { ProductionPage } from "./components/order/ProductionPage";
import { ProcessPage } from "./components/order/ProcessPage";
import { InventoryPage } from "./components/order/InventoryPage";
import { DatasetPage } from "./components/order/DatasetPage";
import { TermsOfServicePage } from './components/TermsOfServicePage';
import { PrivacyPolicyPage } from './components/PrivacyPolicyPage';
import { ProductionProvider } from "./context/ProductionContext";
import { AccessDeniedPage } from "./components/AccessDeniedPage";


function Layout({
  children,
  username,
  role,
  onLogout,
}: {
  children: React.ReactNode;
  username: string;
  role: string | null;
  onLogout: () => void;
}) {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar username={username} role={role} onLogout={onLogout} />
      <main className="flex-1 overflow-auto">{children}</main>
      <AIChatbot />
    </div>
  );
}

function ProtectedRoute({
  children,
  isLoggedIn,
}: {
  children: JSX.Element;
  isLoggedIn: boolean;
}) {
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  return children;
}

function RoleRoute({
  children,
  role,
  allowedRoles,
}: {
  children: JSX.Element;
  role: string | null;
  allowedRoles?: string[];
}) {
  if (!allowedRoles || allowedRoles.length === 0) return children;
  if (!role) return <Navigate to="/access-denied" replace />;
  if (role === "ADMIN" || allowedRoles.includes(role)) return children;
  return <Navigate to="/access-denied" replace />;
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const savedUsername = localStorage.getItem("username");
    const savedRole = localStorage.getItem("role");
    if (token && savedUsername) {
      setIsLoggedIn(true);
      setUsername(savedUsername);
      setRole(savedRole);
    }
    setLoading(false);
  }, []);

  const handleLogin = (user: string, userRole: string) => {
    const savedUsername = localStorage.getItem("username");
    setUsername(user || savedUsername || "User");
    setRole(userRole || localStorage.getItem("role"));
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUsername("");
    setRole(null);
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("role");
  };

  if (loading) return <div>로딩 중...</div>;

  const defaultPath =
    role === "PRODUCTION_MANAGER" ? "/order/orders" : "/dashboard";

  return (
    <BrowserRouter>
      <Routes>
        {/* ✅ 앱 시작(루트)하면 랜딩 페이지 먼저 표시 */}
        <Route
          path="/"
          element={
            isLoggedIn ? (
              <Navigate to={defaultPath} replace />
            ) : (
              <LandingPage />
            )
          }
        />

        <Route
          path="/login"
          element={
            isLoggedIn ? (
              // 로그인 되어있으면 로그인 화면 못 보게 -> 메인 대시보드로 보내기
              <Navigate to={defaultPath} replace />
            ) : (
              <LoginPage onLogin={handleLogin} />
            )
          }
        />

        <Route
          path="/signup"
          element={isLoggedIn ? <Navigate to="/dashboard" replace /> : <SignupPage />}
        />

        {/* Protected Routes */}
        <Route
          path="/*"
          element={
            <ProtectedRoute isLoggedIn={isLoggedIn}>
            <ProductionProvider>
              <Layout username={username} role={role} onLogout={handleLogout}>
                <Routes>
                  {/* 공정확인 */}
                  <Route path="/dashboard" element={
                    <RoleRoute role={role} allowedRoles={["PROCESS_MANAGER"]}>
                      <MainDashboard />
                    </RoleRoute>
                  } />
                  <Route path="/press" element={
                    <RoleRoute role={role} allowedRoles={["PROCESS_MANAGER"]}>
                      <PressMachineDashboard />
                    </RoleRoute>
                  } />
                  <Route path="/welding-image" element={
                    <RoleRoute role={role} allowedRoles={["PROCESS_MANAGER"]}>
                      <WeldingImageDashboard />
                    </RoleRoute>
                  } />
                  <Route path="/windshield" element={
                    <RoleRoute role={role} allowedRoles={["PROCESS_MANAGER"]}>
                      <WindShieldDashboard />
                    </RoleRoute>
                  } />
                  <Route path="/engine-vibration" element={
                    <RoleRoute role={role} allowedRoles={["PROCESS_MANAGER"]}>
                      <EngineVibrationDashboard />
                    </RoleRoute>
                  } />
                  <Route path="/body" element={
                    <RoleRoute role={role} allowedRoles={["PROCESS_MANAGER"]}>
                      <BodyAssemblyDashboard />
                    </RoleRoute>
                  } />
                  <Route path="/paint" element={
                    <RoleRoute role={role} allowedRoles={["PROCESS_MANAGER"]}>
                      <PaintQualityDashboard />
                    </RoleRoute>
                  } />

                  {/* Board Routes */}
                  <Route path="/board" element={<BoardListPage />} />
                  <Route path="/board/write" element={<BoardWritePage />} />
                  <Route path="/board/:id" element={<BoardDetailPage />} />

                  {/* Policy Routes */}
                  <Route path="/terms" element={<TermsOfServicePage />} />
                  <Route path="/privacy" element={<PrivacyPolicyPage />} />

                  {/* 주문생산 */}
                  <Route path="/order/orders" element={
                    <RoleRoute role={role} allowedRoles={["PRODUCTION_MANAGER"]}>
                      <OrderPage />
                    </RoleRoute>
                  } />
                  <Route path="/order/production" element={
                    <RoleRoute role={role} allowedRoles={["PRODUCTION_MANAGER"]}>
                      <ProductionPage />
                    </RoleRoute>
                  } />
                  <Route path="/order/datasets" element={
                    <RoleRoute role={role} allowedRoles={["PRODUCTION_MANAGER"]}>
                      <DatasetPage />
                    </RoleRoute>
                  } />
                  <Route path="/order/process" element={
                    <RoleRoute role={role} allowedRoles={["PRODUCTION_MANAGER"]}>
                      <ProcessPage />
                    </RoleRoute>
                  } />
                  <Route path="/order/inventory" element={
                    <RoleRoute role={role} allowedRoles={["PRODUCTION_MANAGER"]}>
                      <InventoryPage />
                    </RoleRoute>
                  } />
                  <Route path="/order" element={<Navigate to="/order/orders" replace />} />

                  {/* Policy Routes */}
                  <Route path="/terms" element={<TermsOfServicePage />} />
                  <Route path="/privacy" element={<PrivacyPolicyPage />} />
                  <Route path="/access-denied" element={<AccessDeniedPage role={role} onLogout={handleLogout} />} />

                  {/* 없는 경로 처리 */}
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </Layout>
            </ProductionProvider>
          </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
