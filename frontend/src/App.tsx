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
import { TermsOfServicePage } from './components/TermsOfServicePage';
import { PrivacyPolicyPage } from './components/PrivacyPolicyPage';
import { ProductionProvider } from "./context/ProductionContext";
import { AccessDeniedPage } from "./components/AccessDeniedPage";


function Layout({
  children,
  username,
  onLogout,
}: {
  children: React.ReactNode;
  username: string;
  onLogout: () => void;
}) {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar username={username} onLogout={onLogout} />
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
  if (!isLoggedIn) return <Navigate to="/" replace />;
  return children;
}

function RoleGuard({
  children,
  role,
  allowed,
  message,
}: {
  children: JSX.Element;
  role: string;
  allowed: string[];
  message: string;
}) {
  if (!allowed.includes(role)) {
    return <AccessDeniedPage message={message} />;
  }
  return children;
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("PRODUCTION");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const savedUsername = localStorage.getItem("username");
    const savedRole = localStorage.getItem("role");
    if (token && savedUsername) {
      setIsLoggedIn(true);
      setUsername(savedUsername);
      if (savedRole) setRole(savedRole);
    }
    setLoading(false);
  }, []);

  const handleLogin = (user: string) => {
    const savedUsername = localStorage.getItem("username");
    const savedRole = localStorage.getItem("role");
    setUsername(user || savedUsername || "User");
    if (savedRole) setRole(savedRole);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUsername("");
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("role");
  };

  if (loading) return <div>Loading...</div>;

  return (
    <BrowserRouter>
      <Routes>
        {/* ✅ 앱 시작(루트)하면 랜딩 페이지 먼저 표시 */}
        <Route
          path="/"
          element={
            isLoggedIn ? (
              <Navigate to="/dashboard" replace />
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
              <Navigate to="/dashboard" replace />
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
              <Layout username={username} onLogout={handleLogout}>
                <Routes>
                  {/* 공정확인 */}
                  <Route path="/dashboard" element={<MainDashboard />} />
                  <Route
                    path="/press"
                    element={
                      <RoleGuard
                        role={role}
                        allowed={["PROCESS"]}
                        message="이곳은 공정 관리자용 페이지입니다."
                      >
                        <PressMachineDashboard />
                      </RoleGuard>
                    }
                  />
                  <Route
                    path="/welding-image"
                    element={
                      <RoleGuard
                        role={role}
                        allowed={["PROCESS"]}
                        message="이곳은 공정 관리자용 페이지입니다."
                      >
                        <WeldingImageDashboard />
                      </RoleGuard>
                    }
                  />
                  <Route
                    path="/windshield"
                    element={
                      <RoleGuard
                        role={role}
                        allowed={["PROCESS"]}
                        message="이곳은 공정 관리자용 페이지입니다."
                      >
                        <WindShieldDashboard />
                      </RoleGuard>
                    }
                  />
                  <Route
                    path="/engine-vibration"
                    element={
                      <RoleGuard
                        role={role}
                        allowed={["PROCESS"]}
                        message="이곳은 공정 관리자용 페이지입니다."
                      >
                        <EngineVibrationDashboard />
                      </RoleGuard>
                    }
                  />
                  <Route
                    path="/body"
                    element={
                      <RoleGuard
                        role={role}
                        allowed={["PROCESS"]}
                        message="이곳은 공정 관리자용 페이지입니다."
                      >
                        <BodyAssemblyDashboard />
                      </RoleGuard>
                    }
                  />
                  <Route
                    path="/paint"
                    element={
                      <RoleGuard
                        role={role}
                        allowed={["PROCESS"]}
                        message="이곳은 공정 관리자용 페이지입니다."
                      >
                        <PaintQualityDashboard />
                      </RoleGuard>
                    }
                  />

                  {/* Board Routes */}
                  <Route path="/board" element={<BoardListPage />} />
                  <Route path="/board/write" element={<BoardWritePage />} />
                  <Route path="/board/:id" element={<BoardDetailPage />} />

                  {/* Policy Routes */}
                  <Route path="/terms" element={<TermsOfServicePage />} />
                  <Route path="/privacy" element={<PrivacyPolicyPage />} />

                  {/* 주문생산 */}
                  <Route
                    path="/order/orders"
                    element={
                      <RoleGuard
                        role={role}
                        allowed={["PRODUCTION"]}
                        message="이곳은 생산 관리자용 페이지입니다."
                      >
                        <OrderPage />
                      </RoleGuard>
                    }
                  />
                  <Route
                    path="/order/production"
                    element={
                      <RoleGuard
                        role={role}
                        allowed={["PRODUCTION"]}
                        message="이곳은 생산 관리자용 페이지입니다."
                      >
                        <ProductionPage />
                      </RoleGuard>
                    }
                  />
                  <Route
                    path="/order/process"
                    element={
                      <RoleGuard
                        role={role}
                        allowed={["PRODUCTION"]}
                        message="이곳은 생산 관리자용 페이지입니다."
                      >
                        <ProcessPage />
                      </RoleGuard>
                    }
                  />
                  <Route
                    path="/order/inventory"
                    element={
                      <RoleGuard
                        role={role}
                        allowed={["PRODUCTION"]}
                        message="이곳은 생산 관리자용 페이지입니다."
                      >
                        <InventoryPage />
                      </RoleGuard>
                    }
                  />
                  <Route path="/order" element={<Navigate to="/order/orders" replace />} />

                  {/* Policy Routes */}
                  <Route path="/terms" element={<TermsOfServicePage />} />
                  <Route path="/privacy" element={<PrivacyPolicyPage />} />

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
