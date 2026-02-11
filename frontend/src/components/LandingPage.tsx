
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Factory, AlertTriangle, TrendingUp, Activity, CheckCircle2, ArrowRight, Zap, BarChart3, Package } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

interface LandingPageProps {
  role?: string | null;
  isLoggedIn?: boolean;
  onLogout?: () => void;
}

export function LandingPage({ role, isLoggedIn, onLogout }: LandingPageProps) {
  const navigate = useNavigate();
  const showProduction = role === "ADMIN" || role === "PRODUCTION_MANAGER";
  const showProcess = role === "ADMIN" || role === "PROCESS_MANAGER";
  const goProduction = () => {
    localStorage.setItem("app_mode", "order");
    navigate("/order/orders");
  };
  const goProcess = () => {
    localStorage.setItem("app_mode", "process");
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header Navigation */}
      <header className="border-b border-precise border-border sticky top-0 bg-background/95 backdrop-blur-sm z-50">
        <div className="container">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded flex items-center justify-center">
                <Factory className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-semibold leading-none">자동차 공정 관리</h1>
                <p className="text-xs text-muted-foreground">AI 기반 공정 관리 솔루션</p>
              </div>
            </div>
            <nav className="hidden md:flex items-center gap-1">
              <a
                href="#features"
                className="px-3 py-2 rounded text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors duration-200"
              >
                주요 기능
              </a>
              <span className="mx-1 h-4 w-px bg-border/70"></span>
              <a
                href="#how-it-works"
                className="px-3 py-2 rounded text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors duration-200"
              >
                사용 방법
              </a>
            </nav>
            <div className="flex items-center gap-2">
              {isLoggedIn && showProduction && (
                <Button variant="outline" size="sm" onClick={goProduction}>
                  생산관리
                </Button>
              )}
              {isLoggedIn && showProcess && (
                <Button variant="outline" size="sm" onClick={goProcess}>
                  공정관리
                </Button>
              )}
              {!isLoggedIn && (
                <Button variant="outline" size="sm" asChild>
                  <Link to="/login">로그인</Link>
                </Button>
              )}
              {!isLoggedIn && (
                <Button variant="default" size="sm" asChild>
                  <Link to="/signup">회원가입</Link>
                </Button>
              )}
              {isLoggedIn && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    onLogout?.();
                    navigate("/login", { replace: true });
                  }}
                >
                  로그아웃
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section
        className="relative py-28 md:py-36 overflow-hidden"
        style={{
          backgroundImage: `url('https://private-us-east-1.manuscdn.com/sessionFile/lw178XPYvqbIb9oG8STq58/sandbox/fVegLkort57foiCOIjSnJd-img-1_1770266116000_na1fn_aGVyby1ibHVlcHJpbnQtYmc.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvbHcxNzhYUFl2cWJJYjlvRzhTVHE1OC9zYW5kYm94L2ZWZWdMa29ydDU3Zm9pQ09JalNuSmQtaW1nLTFfMTc3MDI2NjExNjAwMF9uYTFmbl9hR1Z5YnkxaWJIVmxjSEpwYm5RdFltYy5wbmc~eC1vc3MtcHJvY2Vzcz1pbWFnZS9yZXNpemUsd18xOTIwLGhfMTkyMC9mb3JtYXQsd2VicC9xdWFsaXR5LHFfODAiLCJDb25kaXRpb24iOnsiRGF0ZUxlc3NUaGFuIjp7IkFXUzpFcG9jaFRpbWUiOjE3OTg3NjE2MDB9fX1dfQ__&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=pEYTfnm8fpVkH75w0-C7SBvSqlLb-C~wJVEQqDW73p5ZMfQGH0AIPwJ9mNKLUy4NVXN8UrPboRtKuCBtuXHPi2-dEej0tx9LyT4zL2FifMUZqM~~WxCCETB2eFZHOtFG5b8mp~Np5zbRc2iYIenjOVUxld6M7EOK6HLa5y9b5qdThsWZ7X-V9MCLgv6Ur9cpNxvzxzon0K~v31gbp7aZRjHp0iVKp~p1RN2gjTg-vzqCR5jWmP2uHN70CyX3urGiFgDYnk45pRfbOZiGwY5vKw3m8lelSm92Etcuh7Eha53gdf~zX45k6NQp57UAbhxhuj9bffWAO6voymxQV99gZQ__')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-background/95"></div>
        <div className="container relative">
          <div className="max-w-3xl space-y-6 rounded-md bg-background/70 backdrop-blur-md border border-border/50 p-6 md:p-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-sm mb-6">
              <span className="text-xs font-mono text-primary">AI 기반 솔루션</span>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold leading-tight text-foreground drop-shadow-sm tracking-tight">
              자동차 공정 이상 탐지 및<br />납기 리스크 예측 플랫폼
            </h1>
            <p className="text-base md:text-lg lg:text-xl text-foreground/80 leading-relaxed drop-shadow-sm">
              인공지능 기반 실시간 모니터링으로 생산 공정의 이상을 사전에 감지하고,
              납기 지연 리스크를 정확하게 예측하여 자동차 제조 프로세스의 효율성을 극대화합니다.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 md:gap-8 pt-8 border-t border-border">
              <div>
                <div className="text-2xl md:text-3xl font-mono font-semibold text-primary mb-1">91.98%</div>
                <div className="text-sm text-muted-foreground">이상 탐지 정확도(평균)</div>
              </div>
              <div>
                <div className="text-2xl md:text-3xl font-mono font-semibold text-primary mb-1">92%</div>
                <div className="text-sm text-muted-foreground">지연 위험 식별 성능</div>
              </div>
              <div>
                <div className="text-2xl md:text-3xl font-mono font-semibold text-primary mb-1">2.8시간</div>
                <div className="text-sm text-muted-foreground">평균 추가 지연 예측 오차</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Service Introduction */}
      <section className="py-24 border-t border-precise border-border">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center mb-12 md:mb-16">
            <h2 className="text-3xl md:text-4xl font-semibold mb-4 tracking-tight">서비스 소개</h2>
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
              자동차 제조 공정의 복잡성과 납기 관리의 어려움을 해결하기 위해 설계된
              통합 관리 플랫폼입니다. 최신 AI 기술과 빅데이터 분석을 통해
              생산 현장의 모든 단계를 실시간으로 모니터링하고 최적화합니다.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-10 max-w-5xl mx-auto">
            <Card className="p-8 bg-card border-precise">
              <div className="w-12 h-12 bg-primary/10 rounded flex items-center justify-center mb-4">
                <Activity className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3 tracking-tight">실시간 공정 모니터링</h3>
              <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                생산 라인의 센서와 이미지 데이터를 실시간으로 수집하고 분석하여
                공정 상태를 한눈에 파악할 수 있습니다. 이상 징후 발생 시
                즉각적인 알림을 통해 신속한 대응이 가능합니다.
              </p>
            </Card>

            <Card className="p-8 bg-card border-precise">
              <div className="w-12 h-12 bg-primary/10 rounded flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3 tracking-tight">AI 기반 이상 탐지</h3>
              <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                센서 데이터와 이미지 분석을 통해 미세한 이상 신호도 놓치지 않고 감지합니다.
                머신러닝 알고리즘이 정상 패턴을 학습하여 오탐률을 최소화하고
                생산 중단 시간을 효과적으로 줄입니다.
              </p>
            </Card>

            <Card className="p-8 bg-card border-precise">
              <div className="w-12 h-12 bg-primary/10 rounded flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3 tracking-tight">납기 리스크 예측</h3>
              <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                공급망 데이터, 생산 진행률, 외부 변수를 종합 분석하여
                납기 지연 가능성을 사전에 예측합니다. 리스크 수준에 따라
                우선순위를 설정하고 선제적 조치를 취할 수 있습니다.
              </p>
            </Card>

            <Card className="p-8 bg-card border-precise">
              <div className="w-12 h-12 bg-primary/10 rounded flex items-center justify-center mb-4">
                <CheckCircle2 className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3 tracking-tight">통합 대시보드</h3>
              <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                공정별 이상 여부, 생산 진행 현황, 납기 리스크를 한 화면에서 확인할 수 있습니다.
                실시간 데이터와 공정 이력을 함께 제공해 현장 대응과 의사결정을 빠르게 지원합니다.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section id="features" className="py-24 border-t border-precise border-border bg-card/30 scroll-mt-24">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center mb-12 md:mb-16">
            <h2 className="text-3xl md:text-4xl font-semibold mb-4 tracking-tight">주요 기능</h2>
            <p className="text-base md:text-lg text-muted-foreground">
              생산 현장의 모든 요구사항을 충족하는 포괄적인 기능을 제공합니다
            </p>
          </div>

          <div className="space-y-20">
            {/* Feature 1 */}
            <div className="grid md:grid-cols-2 gap-14 items-center">
              <div className="order-2 md:order-1">
                <div className="inline-block px-3 py-1 bg-primary/10 border border-primary/20 rounded-sm mb-4">
                  <span className="text-xs font-mono text-primary">기능 01</span>
                </div>
                <h3 className="text-2xl font-semibold mb-4 tracking-tight">실시간 공정 모니터링</h3>
                <p className="text-sm md:text-base text-muted-foreground mb-6 leading-relaxed">
                  주문별 생산 현황을 실시간으로 한눈에 확인할 수 있으며, 완료된 주문과 생산 완료 상태를 즉시 파악할 수 있습니다.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-forest-green flex items-center justify-center mt-0.5 flex-shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-background" />
                    </div>
                    <span className="text-sm">실시간 모니터링</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-forest-green flex items-center justify-center mt-0.5 flex-shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-background" />
                    </div>
                    <span className="text-sm">주문별 생산 상태 확인</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-forest-green flex items-center justify-center mt-0.5 flex-shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-background" />
                    </div>
                    <span className="text-sm">즉각적인 알림 및 경보 시스템</span>
                  </li>
                </ul>
              </div>
              <div className="order-1 md:order-2">
                <img
                  src="/images/기능01.png"
                  alt="실시간 공정 모니터링"
                  className="w-full rounded border border-precise border-border/70"
                />
              </div>
            </div>

            {/* Feature 2 */}
            <div className="grid md:grid-cols-2 gap-14 items-center">
              <div>
                <img
                  src="/images/기능02.png"
                  alt="AI 기반 이상 탐지"
                  className="w-full rounded border border-precise border-border/70"
                />
              </div>
              <div>
                <div className="inline-block px-3 py-1 bg-primary/10 border border-primary/20 rounded-sm mb-4">
                  <span className="text-xs font-mono text-primary">기능 02</span>
                </div>
                <h3 className="text-2xl font-semibold mb-4 tracking-tight">AI 기반 이상 탐지 (센서/이미지)</h3>
                <p className="text-sm md:text-base text-muted-foreground mb-6 leading-relaxed">
                  센서 데이터와 카메라 이미지를 분석하여 정상 패턴을 학습합니다.
                  미세한 이상 신호부터 육안으로 확인하기 어려운 결함까지
                  정확하게 감지하여 품질 문제를 조기에 발견합니다.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-forest-green flex items-center justify-center mt-0.5 flex-shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-background" />
                    </div>
                    <span className="text-sm">센서 데이터 기반 이상 탐지</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-forest-green flex items-center justify-center mt-0.5 flex-shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-background" />
                    </div>
                    <span className="text-sm">AI 비전 기반 결함 검출</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-forest-green flex items-center justify-center mt-0.5 flex-shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-background" />
                    </div>
                    <span className="text-sm">오탐률 최소화 및 신뢰도 향상</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="grid md:grid-cols-2 gap-14 items-center">
              <div className="order-2 md:order-1">
                <div className="inline-block px-3 py-1 bg-primary/10 border border-primary/20 rounded-sm mb-4">
                  <span className="text-xs font-mono text-primary">기능 03</span>
                </div>
                <h3 className="text-2xl font-semibold mb-4 tracking-tight">공정별 생산 진행 관리 및 상태 시각화</h3>
                <p className="text-sm md:text-base text-muted-foreground mb-6 leading-relaxed">
                  프레스, 용접, 도장, 의장 등 공정별 진행률과 상태를 실시간으로 추적합니다.
                  지연 징후를 빠르게 확인하고 생산 효율을 개선할 수 있습니다.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-forest-green flex items-center justify-center mt-0.5 flex-shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-background" />
                    </div>
                    <span className="text-sm">공정별 진행률 추적</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-forest-green flex items-center justify-center mt-0.5 flex-shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-background" />
                    </div>
                    <span className="text-sm">지연 징후 빠른 파악</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-forest-green flex items-center justify-center mt-0.5 flex-shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-background" />
                    </div>
                    <span className="text-sm">상태 대시보드 시각화</span>
                  </li>
                </ul>
              </div>
              <div className="order-1 md:order-2">
                <video
                  className="w-full rounded border border-precise border-border/70"
                  src="/video/기능03.mp4"
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="auto"
                />
              </div>
            </div>

            {/* Feature 4 */}
            <div className="grid md:grid-cols-2 gap-14 items-center">
              <div>
                <img
                  src="/images/기능04.png"
                  alt="납기 리스크 예측"
                  className="w-full rounded border border-precise border-border/70"
                />
              </div>
              <div>
                <div className="inline-block px-3 py-1 bg-primary/10 border border-primary/20 rounded-sm mb-4">
                  <span className="text-xs font-mono text-primary">기능 04</span>
                </div>
                <h3 className="text-2xl font-semibold mb-4 tracking-tight">납기 리스크 예측 및 상태 표시</h3>
                <p className="text-sm md:text-base text-muted-foreground mb-6 leading-relaxed">
                  각 주문의 지연 여부와 지연 확률, 예상 지연 시간을 실시간으로 제공합니다.
                  이를 통해 납기 리스크를 빠르게 파악하고 대응 우선순위를 결정할 수 있습니다
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-forest-green flex items-center justify-center mt-0.5 flex-shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-background" />
                    </div>
                    <span className="text-sm">실시간 납기 예측 제공</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-forest-green flex items-center justify-center mt-0.5 flex-shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-background" />
                    </div>
                    <span className="text-sm">지연 여부·확률 한눈에 확인</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-forest-green flex items-center justify-center mt-0.5 flex-shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-background" />
                    </div>
                    <span className="text-sm">우선 대응 대상 빠른 파악</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Feature 5 */}
            <div className="grid md:grid-cols-2 gap-14 items-center">
              <div className="order-2 md:order-1">
                <div className="inline-block px-3 py-1 bg-primary/10 border border-primary/20 rounded-sm mb-4">
                  <span className="text-xs font-mono text-primary">기능 05</span>
                </div>
                <h3 className="text-2xl font-semibold mb-4 tracking-tight">AI 챗봇 어시스턴트</h3>
                <p className="text-sm md:text-base text-muted-foreground mb-6 leading-relaxed">
                  공정 데이터와 생산 현황에 대해 질문하고 즉시 답변을 받을 수 있습니다.
                  AI 챗봇이 실시간 데이터를 기반으로 현장 상황을 분석하고
                  의사결정에 필요한 정보를 빠르게 제공합니다.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-forest-green flex items-center justify-center mt-0.5 flex-shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-background" />
                    </div>
                    <span className="text-sm">공정 데이터 질의</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-forest-green flex items-center justify-center mt-0.5 flex-shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-background" />
                    </div>
                    <span className="text-sm">실시간 생산 현황 요약 및 분석</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-forest-green flex items-center justify-center mt-0.5 flex-shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-background" />
                    </div>
                    <span className="text-sm">이상 탐지 결과 즉시 확인</span>
                  </li>
                </ul>
              </div>
              <div className="order-1 md:order-2">
                <video
                  className="w-full rounded border border-precise border-border/70"
                  src="/video/기능05.mp4"
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="auto"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 border-t border-precise border-border scroll-mt-24">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center mb-12 md:mb-16">
            <h2 className="text-3xl md:text-4xl font-semibold mb-4 tracking-tight">사용 방법</h2>
            <p className="text-base md:text-lg text-muted-foreground">
              간단한 5단계로 시스템을 도입하고 핵심 기능을 바로 확인할 수 있습니다.
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="space-y-14">
              {/* Step 1 */}
              <div className="flex gap-6">
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center">
                    <span className="text-2xl font-mono font-semibold text-primary-foreground">01</span>
                  </div>
                </div>
                <div className="flex-1 pt-2">
                  <h3 className="text-xl font-semibold mb-3 tracking-tight">회원 가입 또는 로그인</h3>
                  <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                    플랫폼에 회원가입하거나 기존 계정으로 로그인하세요.
                    간단한 정보 입력만으로 계정을 생성할 수 있으며, 공정 관리자와 생산 관리자로 권한이 구분됩니다.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-6">
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center">
                    <span className="text-2xl font-mono font-semibold text-primary-foreground">02</span>
                  </div>
                </div>
                <div className="flex-1 pt-2">
                  <h3 className="text-xl font-semibold mb-3 tracking-tight">대시보드에서 전체 현황 확인</h3>
                  <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                    로그인 후 메인 대시보드에서 전체 생산 현황을 한눈에 확인합니다.
                    실시간 KPI와 생산/주문 상태, 납기 리스크 정보를 직관적으로 파악할 수 있습니다.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-6">
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center">
                    <span className="text-2xl font-mono font-semibold text-primary-foreground">03</span>
                  </div>
                </div>
                <div className="flex-1 pt-2">
                  <h3 className="text-xl font-semibold mb-3 tracking-tight">좌측 메뉴에서 공정별 페이지 이동</h3>
                  <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                    좌측 메뉴에서 프레스, 용접, 도장, 의장, 검사 등 공정별 상세 페이지로 이동합니다.
                    공정별 실시간 모니터링 데이터와 분석 결과를 확인할 수 있습니다.
                  </p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex gap-6">
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center">
                    <span className="text-2xl font-mono font-semibold text-primary-foreground">04</span>
                  </div>
                </div>
                <div className="flex-1 pt-2">
                  <h3 className="text-xl font-semibold mb-3 tracking-tight">이상 탐지 결과와 결함 목록 확인</h3>
                  <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                    각 공정 페이지에서 AI가 탐지한 이상 현황과 결함 목록을 확인합니다.
                    결함 유형, 신뢰도 등 핵심 정보를 통해 빠르게 대응할 수 있습니다.
                  </p>
                </div>
              </div>

              {/* Step 5 */}
              <div className="flex gap-6">
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center">
                    <span className="text-2xl font-mono font-semibold text-primary-foreground">05</span>
                  </div>
                </div>
                <div className="flex-1 pt-2">
                  <h3 className="text-xl font-semibold mb-3 tracking-tight">주문/생산/재고 페이지에서 업무 처리 및 상태 점검</h3>
                  <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                    주문 관리, 생산 진행, 재고 현황을 한 곳에서 관리합니다.
                    주문 상태, 생산 진행률, 납기 예측 정보를 확인하며 업무를 처리할 수 있습니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section 
        id="contact"
        className="py-24 border-t border-precise border-border relative overflow-hidden scroll-mt-24"
        style={{
          backgroundImage: `url('https://private-us-east-1.manuscdn.com/sessionFile/lw178XPYvqbIb9oG8STq58/sandbox/fVegLkort57foiCOIjSnJd-img-5_1770266107000_na1fn_Y3RhLWJhY2tncm91bmQ.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvbHcxNzhYUFl2cWJJYjlvRzhTVHE1OC9zYW5kYm94L2ZWZWdMa29ydDU3Zm9pQ09JalNuSmQtaW1nLTVfMTc3MDI2NjEwNzAwMF9uYTFmbl9ZM1JoTFdKaFkydG5jbTkxYm1RLnBuZz94LW9zcy1wcm9jZXNzPWltYWdlL3Jlc2l6ZSx3XzE5MjAsaF8xOTIwL2Zvcm1hdCx3ZWJwL3F1YWxpdHkscV84MCIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTc5ODc2MTYwMH19fV19&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=dmi3Iqj1~dtAeU-RJl4WCtYPmkx-lQ4D3~FmCx~h8EYykJzMW6IjMYAE0xBPYviZ2-D5sNQekHvI4zDHgutDStx94u-HZg5jkCSF-ltfrWCzbKtvvDbRRaOLsxIC3YD3Ha0~nErna0rxdUH0u--WttZgORjgByFVkdW96HiNjHCRaSZFlIvOLMnX-fnbiWw~6Kt4vadeBNcpaLwkerBQyHEqs~r-dwXfZZglzD6sizf6N9CaQD7geKnjf3xxqjrwS0vgRXACL6o4PIKDcy-4B3cTfKelLmDhbtgEGGjWU3RfmM4uwcT~3J7CTzMvdwc389Qa6qM7sBcq-6jJ497phg__')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-background/95"></div>
        <div className="container relative">
          <div className="max-w-3xl mx-auto text-center space-y-4">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
              지금 바로 시작하세요
            </h2>
            <p className="text-base md:text-lg text-muted-foreground">
              회원가입만 하면 AI 기반 공정 이상 탐지와 납기 리스크 예측 기능을 바로 체험할 수 있습니다.
              실시간 모니터링부터 생산 현황 분석까지, 스마트 팩토리의 핵심 기능을 직접 경험해보세요.
            </p>
            <div className="flex justify-center">
              <Button size="lg" className="text-base" asChild>
                <Link to="/signup">
                  시작하기
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Trusted Customers */}
        <section className="border-t border-precise border-border py-20 bg-white">
        <div className="container">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-semibold mb-3 tracking-tight text-black">희망하는 고객사</h2>
            <p className="text-base text-muted-foreground">자동차 제조 현장의 혁신을 함께할 파트너를 찾습니다.</p>
          </div>

            <div className="flex items-center justify-center">
              <img
                src="/images/all.png"
                alt="희망하는 고객사 로고"
                className="max-w-full h-auto"
              />
            </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-precise border-border py-12">
        <div className="container">
          <div className="text-center text-sm text-muted-foreground">
            <p>© 자동차 공정 관리 시스템.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
