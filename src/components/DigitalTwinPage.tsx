const digitalTwinUrl = import.meta.env.VITE_DIGITAL_TWIN_URL ?? '/digital-twin/';

export function DigitalTwinPage() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">디지털 트윈 시뮬레이션</h2>
            <p className="text-sm text-slate-500">
              외부 앱이 로드되지 않으면 환경 변수 <span className="font-medium">VITE_DIGITAL_TWIN_URL</span>을
              디지털 트윈 앱 주소로 설정하세요.
            </p>
          </div>
          <a
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            href={digitalTwinUrl}
            target="_blank"
            rel="noreferrer"
          >
            새 창에서 열기
          </a>
        </div>
      </div>
      <div className="flex-1 bg-slate-50">
        <iframe
          className="h-full w-full border-0"
          src={digitalTwinUrl}
          title="Digital Twin"
          loading="lazy"
        />
      </div>
    </div>
  );
}
