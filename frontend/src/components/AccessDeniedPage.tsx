import { useNavigate } from "react-router-dom";

export function AccessDeniedPage({ message }: { message: string }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white border rounded-2xl shadow-sm p-8 max-w-md w-full text-center">
        <h1 className="text-xl font-bold text-gray-900 mb-3">접근 불가</h1>
        <p className="text-gray-600 mb-6">{message}</p>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
        >
          뒤로가기
        </button>
      </div>
    </div>
  );
}
