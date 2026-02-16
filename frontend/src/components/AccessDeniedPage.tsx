import { Link, useNavigate } from "react-router-dom";

type AccessDeniedPageProps = {
  role?: string | null;
  onLogout: () => void;
};

export function AccessDeniedPage({ onLogout }: AccessDeniedPageProps) {
  const navigate = useNavigate();
  const homePath = "/dashboard";
  const homeLabel = "대시보드로";
  const handleRelogin = () => {
    onLogout();
    navigate("/login", { replace: true });
  };
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">접근 권한이 없습니다</h1>
        <p className="text-slate-600 mb-6">
          현재 계정의 역할로는 이 페이지에 접근할 수 없습니다.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            to={homePath}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800"
          >
            {homeLabel}
          </Link>
          <button
            type="button"
            onClick={handleRelogin}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            다시 로그인
          </button>
        </div>
      </div>
    </div>
  );
}
