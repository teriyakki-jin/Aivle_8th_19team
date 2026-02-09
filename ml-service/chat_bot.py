"""
공정 관리 AI 챗봇 모듈
- LangChain Agent + Tools 패턴 사용
- 실시간 공정 API 연동
"""
import os
import json
import requests
from threading import Lock
from typing import Optional, Dict, Any

from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_openai_tools_agent
from langchain.tools import Tool
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.memory import ConversationBufferMemory

# =========================
# 설정
# =========================
BACKEND_BASE_URL = os.getenv("BACKEND_BASE_URL", "http://localhost:3001")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

# 세션 관리
CHATBOT_SESSIONS: Dict[str, AgentExecutor] = {}
CHATBOT_LOCK = Lock()


# =========================
# API 호출 헬퍼
# =========================
def call_backend_api(endpoint: str) -> Dict[str, Any]:
    """백엔드 API 호출"""
    try:
        url = f"{BACKEND_BASE_URL}{endpoint}"
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        return {"error": str(e)}


# =========================
# 도구 함수들 (Tools)
# =========================
def get_dashboard_summary(_: str = "") -> str:
    """메인 대시보드 요약 정보 조회"""
    data = call_backend_api("/api/v1/dashboard/main")
    if "error" in data:
        return f"대시보드 조회 실패: {data['error']}"

    result = []
    result.append("=== 공정 현황 요약 ===")

    if "totalAnomalies" in data:
        result.append(f"- 총 이상 발생: {data.get('totalAnomalies', 0)}건")
    if "totalWarnings" in data:
        result.append(f"- 경고: {data.get('totalWarnings', 0)}건")
    if "overallEfficiency" in data:
        result.append(f"- 전체 가동률: {data.get('overallEfficiency', 0)}%")
    if "productionEfficiency" in data:
        result.append(f"- 생산 효율: {data.get('productionEfficiency', 0)}%")
    if "totalDelayHours" in data:
        result.append(f"- 총 지연 시간: {data.get('totalDelayHours', 0):.1f}시간")

    # 주문/생산 요약
    if "orderSummary" in data and data["orderSummary"]:
        os = data["orderSummary"]
        result.append(f"\n=== 주문 현황 ===")
        result.append(f"- 전체: {os.get('total', 0)}건")
        result.append(f"- 진행중: {os.get('partiallyAllocated', 0) + os.get('fullyAllocated', 0)}건")
        result.append(f"- 완료: {os.get('completed', 0)}건")

    if "productionSummary" in data and data["productionSummary"]:
        ps = data["productionSummary"]
        result.append(f"\n=== 생산 현황 ===")
        result.append(f"- 전체: {ps.get('total', 0)}건")
        result.append(f"- 진행중: {ps.get('inProgress', 0)}건")
        result.append(f"- 완료: {ps.get('completed', 0)}건")

    return "\n".join(result) if result else "데이터를 가져올 수 없습니다."


def get_order_list(_: str = "") -> str:
    """주문 목록 조회"""
    data = call_backend_api("/api/v1/order?page=0&size=10")
    if "error" in data:
        return f"주문 목록 조회 실패: {data['error']}"

    content = data.get("content", [])
    if not content:
        return "등록된 주문이 없습니다."

    result = ["=== 최근 주문 목록 (최대 10건) ==="]
    for order in content[:10]:
        order_id = order.get("orderId") or order.get("id")
        status = order.get("orderStatus", "N/A")
        qty = order.get("orderQty", 0)
        model = order.get("vehicleModelName", "N/A")
        result.append(f"- 주문#{order_id}: {model} x {qty}대 [{status}]")

    return "\n".join(result)


def get_production_list(_: str = "") -> str:
    """생산 목록 조회"""
    data = call_backend_api("/api/v1/production?page=0&size=10")
    if "error" in data:
        return f"생산 목록 조회 실패: {data['error']}"

    content = data.get("content", [])
    if not content:
        return "등록된 생산이 없습니다."

    result = ["=== 최근 생산 목록 (최대 10건) ==="]
    for prod in content[:10]:
        prod_id = prod.get("productionId") or prod.get("id")
        status = prod.get("productionStatus") or prod.get("status", "N/A")
        order_id = prod.get("orderId", "N/A")
        result.append(f"- 생산#{prod_id}: 주문#{order_id} [{status}]")

    return "\n".join(result)


def get_defect_summary(_: str = "") -> str:
    """결함 요약 조회"""
    data = call_backend_api("/api/v1/defect-summary")
    if "error" in data:
        return f"결함 요약 조회 실패: {data['error']}"

    if not data or (isinstance(data, list) and len(data) == 0):
        return "결함 데이터가 없습니다."

    result = ["=== 결함 요약 ==="]

    if isinstance(data, list):
        for item in data[:5]:
            model = item.get("vehicleModelName", "N/A")
            status = item.get("overallStatus", "N/A")
            defect_count = item.get("totalDefectCount", 0)
            result.append(f"- {model}: {defect_count}건 [{status}]")
    else:
        result.append(json.dumps(data, ensure_ascii=False, indent=2))

    return "\n".join(result)


def get_delay_prediction(_: str = "") -> str:
    """납기 지연 예측 조회"""
    data = call_backend_api("/api/v1/delay-prediction/overview")
    if "error" in data:
        return f"지연 예측 조회 실패: {data['error']}"

    result = ["=== 납기 지연 예측 ==="]

    if "totalOrders" in data:
        result.append(f"- 총 주문: {data.get('totalOrders', 0)}건")
    if "maxDelayHours" in data:
        result.append(f"- 최대 예상 지연: {data.get('maxDelayHours', 0):.1f}시간")
    if "avgDelayHours" in data:
        result.append(f"- 평균 예상 지연: {data.get('avgDelayHours', 0):.1f}시간")

    if "riskDistribution" in data:
        rd = data["riskDistribution"]
        result.append("\n[리스크 분포]")
        for level, count in rd.items():
            result.append(f"  - {level}: {count}건")

    return "\n".join(result) if len(result) > 1 else "지연 예측 데이터가 없습니다."


def get_duedate_predictions(_: str = "") -> str:
    """실시간 납기 예측 조회"""
    data = call_backend_api("/api/v1/duedate-predictions/latest?limit=10")
    if "error" in data:
        return f"납기 예측 조회 실패: {data['error']}"

    if not data or (isinstance(data, list) and len(data) == 0):
        return "납기 예측 데이터가 없습니다. 생산이 진행 중이어야 예측이 생성됩니다."

    result = ["=== 실시간 납기 예측 (최근 10건) ==="]

    for item in data[:10]:
        order_id = item.get("orderId", "N/A")
        stage = item.get("snapshotStage", "N/A")
        delay_flag = item.get("delayFlag", 0)
        delay_prob = item.get("delayProbability", 0)
        delay_min = item.get("predictedDelayMinutes", 0)

        status = "지연" if delay_flag == 1 else "정상"
        result.append(f"- 주문#{order_id} ({stage}): {status}, 확률 {delay_prob*100:.0f}%, 예상 {delay_min:.0f}분")

    return "\n".join(result)


def get_vehicle_models(_: str = "") -> str:
    """차량 모델 목록 조회"""
    data = call_backend_api("/api/v1/vehicle-model")
    if "error" in data:
        return f"차량 모델 조회 실패: {data['error']}"

    content = data.get("content", data) if isinstance(data, dict) else data
    if not content:
        return "등록된 차량 모델이 없습니다."

    result = ["=== 차량 모델 목록 ==="]

    if isinstance(content, list):
        for model in content[:10]:
            name = model.get("name") or model.get("modelName", "N/A")
            model_id = model.get("id") or model.get("vehicleModelId", "N/A")
            result.append(f"- {name} (ID: {model_id})")

    return "\n".join(result)


# =========================
# 도구 목록 생성
# =========================
def create_tools():
    """LangChain Tools 생성"""
    return [
        Tool(
            name="get_dashboard_summary",
            func=get_dashboard_summary,
            description="공정 전체 현황, 이상 발생 건수, 가동률, 주문/생산 요약 등 대시보드 정보를 조회합니다. 전반적인 상태를 알고 싶을 때 사용하세요."
        ),
        Tool(
            name="get_order_list",
            func=get_order_list,
            description="최근 주문 목록을 조회합니다. 주문 번호, 차량 모델, 수량, 상태를 확인할 수 있습니다."
        ),
        Tool(
            name="get_production_list",
            func=get_production_list,
            description="최근 생산 목록을 조회합니다. 생산 진행 상태를 확인할 수 있습니다."
        ),
        Tool(
            name="get_defect_summary",
            func=get_defect_summary,
            description="결함 요약 정보를 조회합니다. 공정별 결함 현황을 확인할 수 있습니다."
        ),
        Tool(
            name="get_delay_prediction",
            func=get_delay_prediction,
            description="납기 지연 예측 정보를 조회합니다. 전체 주문의 지연 리스크를 확인할 수 있습니다."
        ),
        Tool(
            name="get_duedate_predictions",
            func=get_duedate_predictions,
            description="실시간 납기 예측을 조회합니다. 현재 생산 중인 주문의 지연 확률과 예상 지연 시간을 확인할 수 있습니다."
        ),
        Tool(
            name="get_vehicle_models",
            func=get_vehicle_models,
            description="차량 모델 목록을 조회합니다."
        ),
    ]


# =========================
# 시스템 프롬프트
# =========================
SYSTEM_PROMPT = """당신은 자동차 제조 공정 관리 AI 어시스턴트입니다.

## 역할
- 실시간 공정 현황 안내
- 주문/생산 상태 조회
- 결함 및 이상 발생 현황 안내
- 납기 지연 예측 정보 제공

## 사용 가능한 도구
필요한 정보를 조회하기 위해 제공된 도구들을 적극 활용하세요:
- get_dashboard_summary: 전체 현황 요약
- get_order_list: 주문 목록
- get_production_list: 생산 목록
- get_defect_summary: 결함 요약
- get_delay_prediction: 지연 예측 개요
- get_duedate_predictions: 실시간 납기 예측
- get_vehicle_models: 차량 모델 목록

## 응답 지침
1. 사용자 질문에 맞는 도구를 호출하여 실시간 데이터를 조회하세요
2. 데이터를 바탕으로 명확하고 간결하게 답변하세요
3. 한국어로 친절하게 응답하세요
4. 숫자나 통계는 보기 쉽게 정리해서 제공하세요
5. 문제가 발견되면 주의사항도 함께 안내하세요

## 예시 질문
- "현재 공정 상태 알려줘"
- "이상 발생 건수가 몇 건이야?"
- "주문 목록 보여줘"
- "납기 지연 예측 결과는?"
- "오늘 결함 현황 알려줘"
"""


# =========================
# Agent 생성
# =========================
def create_chatbot_agent(session_id: str) -> AgentExecutor:
    """세션별 챗봇 Agent 생성"""
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        raise ValueError("OPENAI_API_KEY is not set")

    # LLM 초기화
    llm = ChatOpenAI(
        model=OPENAI_MODEL,
        temperature=0.2,
        openai_api_key=api_key
    )

    # 도구 생성
    tools = create_tools()

    # 프롬프트 템플릿
    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        MessagesPlaceholder(variable_name="chat_history"),
        ("human", "{input}"),
        MessagesPlaceholder(variable_name="agent_scratchpad"),
    ])

    # Agent 생성
    agent = create_openai_tools_agent(llm, tools, prompt)

    # 메모리 (대화 기록)
    memory = ConversationBufferMemory(
        memory_key="chat_history",
        return_messages=True
    )

    # AgentExecutor
    agent_executor = AgentExecutor(
        agent=agent,
        tools=tools,
        memory=memory,
        verbose=True,
        handle_parsing_errors=True,
        max_iterations=5
    )

    return agent_executor


def get_or_create_agent(session_id: str) -> AgentExecutor:
    """세션별 Agent 가져오기 또는 생성"""
    with CHATBOT_LOCK:
        if session_id not in CHATBOT_SESSIONS:
            CHATBOT_SESSIONS[session_id] = create_chatbot_agent(session_id)
        return CHATBOT_SESSIONS[session_id]


def chat(session_id: str, message: str) -> str:
    """챗봇 대화 실행"""
    if not session_id or not message.strip():
        return "세션 ID와 메시지가 필요합니다."

    try:
        agent = get_or_create_agent(session_id)
        response = agent.invoke({"input": message})
        return response.get("output", "응답을 생성할 수 없습니다.")
    except Exception as e:
        return f"오류가 발생했습니다: {str(e)}"


# =========================
# 테스트용
# =========================
if __name__ == "__main__":
    # 테스트
    print("=== 챗봇 테스트 ===")
    session = "test_session"

    questions = [
        "현재 공정 전체 현황을 알려줘",
        "주문 목록 보여줘",
        "납기 지연 예측 결과는?",
    ]

    for q in questions:
        print(f"\n[질문] {q}")
        answer = chat(session, q)
        print(f"[답변] {answer}")
