/**
 * Design Philosophy: Swiss Design meets Automotive Engineering
 * - Precise grid system with mathematical proportions
 * - Deep charcoal (#1e293b) + silver gray (#64748b) + signature blue (#3b82f6)
 * - IBM Plex Sans/Mono typography for technical credibility
 * - Minimal animations: fade-in only, color transitions on hover
 * - 1px precision borders, clean sectioning
 */

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Factory, AlertTriangle, TrendingUp, Activity, CheckCircle2, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export function LandingPage() {
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
                <p className="text-xs text-muted-foreground">Automotive Process Management</p>
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
              <span className="mx-1 h-4 w-px bg-border/70"></span>
              <a
                href="#contact"
                className="px-3 py-2 rounded text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors duration-200"
              >
                문의하기
              </a>
            </nav>
            <Button variant="default" size="sm" asChild>
              <Link to="/login">시작하기</Link>
            </Button>
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
        
        <div className="absolute inset-0 -z-10 bg-background/60"></div>
        <div className="container relative">
          <div className="max-w-3xl space-y-6 rounded-md bg-background/70 backdrop-blur-sm border border-border/50 p-6 md:p-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-sm mb-6">
              <span className="text-xs font-mono text-primary">AI-POWERED SOLUTION</span>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold leading-tight text-foreground drop-shadow-sm tracking-tight">
              자동차 공정 이상 탐지 및<br />납기 리스크 예측 플랫폼
            </h1>
            <p className="text-base md:text-lg lg:text-xl text-foreground/80 leading-relaxed drop-shadow-sm">
              인공지능 기반 실시간 모니터링으로 생산 공정의 이상을 사전에 감지하고, 
              납기 지연 리스크를 정확하게 예측하여 자동차 제조 프로세스의 효율성을 극대화합니다.
            </p>
            <div className="flex flex-col sm:flex-row gap-5 pt-2">
              <Button size="lg" className="text-base" asChild>
                <Link to="/signup">
                  무료 데모 신청
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="text-base" asChild>
                <a href="#features">상세 자료 보기</a>
              </Button>
            </div>
            
            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 md:gap-8 pt-8 border-t border-border">
              <div>
                <div className="text-2xl md:text-3xl font-mono font-semibold text-primary mb-1">99.2%</div>
                <div className="text-sm text-muted-foreground">이상 탐지 정확도</div>
              </div>
              <div>
                <div className="text-2xl md:text-3xl font-mono font-semibold text-primary mb-1">87%</div>
                <div className="text-sm text-muted-foreground">납기 준수율 향상</div>
              </div>
              <div>
                <div className="text-2xl md:text-3xl font-mono font-semibold text-primary mb-1">24/7</div>
                <div className="text-sm text-muted-foreground">실시간 모니터링</div>
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
                생산 라인의 모든 센서 데이터를 실시간으로 수집하고 분석하여 
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
                머신러닝 알고리즘이 과거 데이터를 학습하여 정상 패턴을 이해하고, 
                미세한 이상 신호도 놓치지 않고 감지합니다. 오탐률을 최소화하여 
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
                모든 정보를 하나의 직관적인 인터페이스에서 확인할 수 있습니다. 
                커스터마이징 가능한 위젯과 상세 리포트 기능으로 
                의사결정에 필요한 인사이트를 즉시 얻을 수 있습니다.
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
                  <span className="text-xs font-mono text-primary">FEATURE 01</span>
                </div>
                <h3 className="text-2xl font-semibold mb-4 tracking-tight">실시간 이상 탐지 시스템</h3>
                <p className="text-sm md:text-base text-muted-foreground mb-6 leading-relaxed">
                  센서 데이터를 실시간으로 분석하여 온도, 진동, 압력 등의 이상 패턴을 즉시 감지합니다. 
                  열화상 스캔과 AI 비전 시스템을 통해 육안으로 확인하기 어려운 결함도 정확하게 포착합니다.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-forest-green flex items-center justify-center mt-0.5 flex-shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-background" />
                    </div>
                    <span className="text-sm">다중 센서 데이터 통합 분석</span>
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
                    <span className="text-sm">즉각적인 알림 및 경보 시스템</span>
                  </li>
                </ul>
              </div>
              <div className="order-1 md:order-2">
                <img 
                  src="https://private-us-east-1.manuscdn.com/sessionFile/lw178XPYvqbIb9oG8STq58/sandbox/fVegLkort57foiCOIjSnJd-img-2_1770266117000_na1fn_ZmVhdHVyZS1hbm9tYWx5LWRldGVjdGlvbg.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvbHcxNzhYUFl2cWJJYjlvRzhTVHE1OC9zYW5kYm94L2ZWZWdMa29ydDU3Zm9pQ09JalNuSmQtaW1nLTJfMTc3MDI2NjExNzAwMF9uYTFmbl9abVZoZEhWeVpTMWhibTl0WVd4NUxXUmxkR1ZqZEdsdmJnLnBuZz94LW9zcy1wcm9jZXNzPWltYWdlL3Jlc2l6ZSx3XzE5MjAsaF8xOTIwL2Zvcm1hdCx3ZWJwL3F1YWxpdHkscV84MCIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTc5ODc2MTYwMH19fV19&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=a2DV-EmgJmL~ZG4lnFzQrs0SEueSAj1lJr5syEeFQNdFE94xU6fpa4jPgCu4B-zL2ZePbmRfiMCld~wVTZqhZS1ZBfs1rw2lUEd2vHi47UNld6FUeAtjY2GVZo32kccXIah~pLRH2StyLYNiI9X~5BeZ~8J5NqFsncYcSEODTjFwXmHG9DyMFNb0ckYUYo83hA0~-uo9ZLIaF0wzpBNr9qdT57fDgdZ~NhpfgEHLhodWuOYfiJPo6bzpr7l0LefQF-SdBgPIUPwD29XBXWcsNinHqnXoDr-yE3cI3F-iSqHGIklxMVOSX6w6uQ~Ilvd4tb5mN2QbsQLot3DTXV867g__"
                  alt="실시간 이상 탐지 시스템"
                  className="w-full rounded border border-precise border-border/70 opacity-70 saturate-50 contrast-90 grayscale mix-blend-multiply"
                />
              </div>
            </div>

            {/* Feature 2 */}
            <div className="grid md:grid-cols-2 gap-14 items-center">
              <div>
                <img 
                  src="https://private-us-east-1.manuscdn.com/sessionFile/lw178XPYvqbIb9oG8STq58/sandbox/fVegLkort57foiCOIjSnJd-img-3_1770266116000_na1fn_ZmVhdHVyZS1yaXNrLXByZWRpY3Rpb24.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvbHcxNzhYUFl2cWJJYjlvRzhTVHE1OC9zYW5kYm94L2ZWZWdMa29ydDU3Zm9pQ09JalNuSmQtaW1nLTNfMTc3MDI2NjExNjAwMF9uYTFmbl9abVZoZEhWeVpTMXlhWE5yTFhCeVpXUnBZM1JwYjI0LnBuZz94LW9zcy1wcm9jZXNzPWltYWdlL3Jlc2l6ZSx3XzE5MjAsaF8xOTIwL2Zvcm1hdCx3ZWJwL3F1YWxpdHkscV84MCIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTc5ODc2MTYwMH19fV19&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=beu4TPhWzzIVMjFO4CDiq-4iAa7J8QKZYp-e-csTpc4CR3EKzUdUKMe2k1~lkEHAfL5Fvv3ZhUS3zt7Cbo9-CkdLHJIWzBwd9oBAedr6N1DYpvrgUppqUkbfbxHU1iyjzURMeG4SA0uUXGbBxrP0280aUK2Av6LB9Zhz7j~1uZa-nOH2nTVZeMuPiO0MvWNQJkKftoiBElLAC4tgjXTm9WiqQxngIWqyOpS08GYUtOuN~y~zKB2Z1SNJc0BeKuyjsqSqk3ywCXlPjrFEDJvCr83ssodAYM2Nlk3Ps6gigXHfg3TyiRG~NmO1MVVoF~VfTX9C-PmEQfqw23udGpgOpA__"
                  alt="납기 리스크 예측"
                  className="w-full rounded border border-precise border-border/70 opacity-70 saturate-50 contrast-90 grayscale mix-blend-multiply"
                />
              </div>
              <div>
                <div className="inline-block px-3 py-1 bg-primary/10 border border-primary/20 rounded-sm mb-4">
                  <span className="text-xs font-mono text-primary">FEATURE 02</span>
                </div>
                <h3 className="text-2xl font-semibold mb-4 tracking-tight">납기 리스크 예측 분석</h3>
                <p className="text-sm md:text-base text-muted-foreground mb-6 leading-relaxed">
                  공급망 전체를 가시화하고 각 단계별 진행 상황을 추적합니다. 
                  과거 데이터와 현재 상황을 종합하여 납기 지연 가능성을 예측하고, 
                  리스크 수준에 따라 색상으로 구분하여 직관적으로 표시합니다.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-forest-green flex items-center justify-center mt-0.5 flex-shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-background" />
                    </div>
                    <span className="text-sm">공급망 전체 가시성 확보</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-forest-green flex items-center justify-center mt-0.5 flex-shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-background" />
                    </div>
                    <span className="text-sm">예측 모델 기반 리스크 평가</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-forest-green flex items-center justify-center mt-0.5 flex-shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-background" />
                    </div>
                    <span className="text-sm">우선순위 기반 대응 전략 제시</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="grid md:grid-cols-2 gap-14 items-center">
              <div className="order-2 md:order-1">
                <div className="inline-block px-3 py-1 bg-primary/10 border border-primary/20 rounded-sm mb-4">
                  <span className="text-xs font-mono text-primary">FEATURE 03</span>
                </div>
                <h3 className="text-2xl font-semibold mb-4 tracking-tight">통합 모니터링 대시보드</h3>
                <p className="text-sm md:text-base text-muted-foreground mb-6 leading-relaxed">
                  생산 효율, 품질 지표, 장비 상태 등 모든 핵심 지표를 한눈에 확인할 수 있는 
                  통합 대시보드를 제공합니다. 실시간 데이터 업데이트와 과거 추세 분석을 통해 
                  데이터 기반 의사결정을 지원합니다.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-forest-green flex items-center justify-center mt-0.5 flex-shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-background" />
                    </div>
                    <span className="text-sm">커스터마이징 가능한 위젯</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-forest-green flex items-center justify-center mt-0.5 flex-shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-background" />
                    </div>
                    <span className="text-sm">실시간 데이터 시각화</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-forest-green flex items-center justify-center mt-0.5 flex-shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-background" />
                    </div>
                    <span className="text-sm">상세 리포트 자동 생성</span>
                  </li>
                </ul>
              </div>
              <div className="order-1 md:order-2">
                <img 
                  src="https://private-us-east-1.manuscdn.com/sessionFile/lw178XPYvqbIb9oG8STq58/sandbox/fVegLkort57foiCOIjSnJd-img-4_1770266118000_na1fn_ZmVhdHVyZS1yZWFsdGltZS1tb25pdG9yaW5n.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvbHcxNzhYUFl2cWJJYjlvRzhTVHE1OC9zYW5kYm94L2ZWZWdMa29ydDU3Zm9pQ09JalNuSmQtaW1nLTRfMTc3MDI2NjExODAwMF9uYTFmbl9abVZoZEhWeVpTMXlaV0ZzZEdsdFpTMXRiMjVwZEc5eWFXNW4ucG5nP3gtb3NzLXByb2Nlc3M9aW1hZ2UvcmVzaXplLHdfMTkyMCxoXzE5MjAvZm9ybWF0LHdlYnAvcXVhbGl0eSxxXzgwIiwiQ29uZGl0aW9uIjp7IkRhdGVMZXNzVGhhbiI6eyJBV1M6RXBvY2hUaW1lIjoxNzk4NzYxNjAwfX19XX0_&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=Y0T83J-RMAFrB7yEZNvz-Ko-oZu~SiPXeRZAyTbFPWoi17t9bfV62OkIoIdnZtvw~vpYWbA9K4H-YXzv8OHRXLxhbJJWucEYS2XgsCwtLVxQvsc~9rF-b-xI7Y6aJqp11KCmkLhSYf3f1o05tsKHT1bwhhsCRk7GTnBux3k9wbwRqMtIRgzuGT0abAs9ERWjQAAL6tZmH1TUTwlo3Xunu4O2D0-fkPzG49wR-TElIF47TkzPAYUS-u3lYNZOZ1YrGrGBgkzBOrVqA4IsR1Q2go7EVnPF2k2uuUUfqzpjogBDFteIa1VdNjbE0PvLNYc7Wgwusy2sS-VRQfEjZvsuLg__"
                  alt="통합 모니터링 대시보드"
                  className="w-full rounded border border-precise border-border/70 opacity-70 saturate-50 contrast-90 grayscale mix-blend-multiply"
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
              간단한 4단계로 시스템을 도입하고 즉시 효과를 확인할 수 있습니다
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
                  <h3 className="text-xl font-semibold mb-3 tracking-tight">센서 및 데이터 연동</h3>
                  <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                    기존 생산 설비의 센서와 MES(제조실행시스템)를 플랫폼에 연결합니다. 
                    표준 프로토콜을 지원하여 대부분의 장비와 호환되며, 
                    전문 엔지니어가 현장 설치와 초기 설정을 지원합니다.
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
                  <h3 className="text-xl font-semibold mb-3 tracking-tight">AI 모델 학습 및 최적화</h3>
                  <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                    수집된 과거 데이터를 바탕으로 AI 모델이 정상 패턴을 학습합니다. 
                    약 2-4주간의 학습 기간을 거쳐 귀사의 생산 환경에 최적화된 
                    이상 탐지 및 예측 모델이 완성됩니다.
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
                  <h3 className="text-xl font-semibold mb-3 tracking-tight">실시간 모니터링 시작</h3>
                  <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                    대시보드를 통해 생산 현장의 모든 지표를 실시간으로 모니터링합니다. 
                    이상 징후 발생 시 즉각적인 알림을 받고, 상세 분석 리포트를 통해 
                    원인을 파악하고 신속하게 대응할 수 있습니다.
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
                  <h3 className="text-xl font-semibold mb-3 tracking-tight">지속적 개선 및 최적화</h3>
                  <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                    축적된 데이터를 분석하여 생산 프로세스의 개선점을 도출합니다. 
                    AI 모델은 지속적으로 학습하며 정확도를 향상시키고, 
                    정기 리포트를 통해 장기적인 효율성 개선 효과를 확인할 수 있습니다.
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
        <div className="absolute inset-0 -z-10 bg-background/60"></div>
        <div className="container relative">
          <div className="max-w-3xl mx-auto text-center space-y-4">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
              지금 바로 시작하세요
            </h2>
            <p className="text-base md:text-lg text-muted-foreground">
              무료 데모를 통해 플랫폼의 강력한 기능을 직접 경험해보세요. 
              전문 컨설턴트가 귀사의 생산 환경에 최적화된 솔루션을 제안해드립니다.
            </p>
            <div className="flex flex-col sm:flex-row gap-5 justify-center">
              <Button size="lg" className="text-base" asChild>
                <Link to="/signup">
                  무료 데모 신청
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="text-base" asChild>
                <a href="#contact">영업팀 문의하기</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-precise border-border py-16">
        <div className="container">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
                  <Factory className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="font-semibold">자동차 공정 관리</span>
              </div>
              <p className="text-sm text-muted-foreground">
                AI 기반 자동차 제조 공정 최적화 플랫폼
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-3">제품</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors duration-200">이상 탐지</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors duration-200">리스크 예측</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors duration-200">대시보드</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors duration-200">가격 정책</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">회사</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors duration-200">회사 소개</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors duration-200">고객 사례</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors duration-200">채용</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors duration-200">블로그</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">지원</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors duration-200">문서</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors duration-200">API</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors duration-200">고객 지원</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors duration-200">문의하기</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-border text-center text-sm text-muted-foreground">
            <p>© 2026 자동차 공정 관리 시스템. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
