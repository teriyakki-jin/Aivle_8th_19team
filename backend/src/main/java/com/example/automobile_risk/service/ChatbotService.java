package com.example.automobile_risk.service;

import com.example.automobile_risk.dto.ChatbotResponse;
import com.example.automobile_risk.dto.openai.*;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChatbotService {

    private static final int MAX_TOOL_CALLS = 3;

    private static final String SYSTEM_PROMPT = """
            당신은 자동차 제조 공정 관리 AI 어시스턴트입니다.
            사용자의 질문에 대해 내부 API를 호출하여 실시간 데이터를 기반으로 답변합니다.

            답변 시 다음 규칙을 따르세요:
            1. 한국어로 답변합니다.
            2. 데이터를 기반으로 정확하게 답변합니다.
            3. 주요 수치는 강조하여 표시합니다.
            4. 필요 시 개선 방안이나 권장 조치를 제안합니다.
            5. 답변 마지막에 "---\\ndata_summary:" 형식으로 핵심 데이터 요약을 한 줄로 추가합니다.
               예: ---\\ndata_summary: 대시보드 기준 이상 22건, 경고 45건, 가동률 86.6%
            """;

    private final OpenAiClient openAiClient;
    private final InternalApiClient internalApiClient;
    private final ObjectMapper objectMapper;

    public ChatbotResponse query(String message) {
        try {
            List<OpenAiMessage> messages = new ArrayList<>();
            messages.add(OpenAiMessage.system(SYSTEM_PROMPT));
            messages.add(OpenAiMessage.user(message));

            List<OpenAiTool> tools = List.of(OpenAiClient.buildCallSpringApiTool());

            int toolCallCount = 0;

            while (toolCallCount < MAX_TOOL_CALLS) {
                OpenAiChatResponse response = openAiClient.chat(messages, tools);

                if (response == null || response.getChoices() == null || response.getChoices().isEmpty()) {
                    return fallbackResponse();
                }

                OpenAiMessage assistantMessage = response.getChoices().get(0).getMessage();
                String finishReason = response.getChoices().get(0).getFinishReason();

                messages.add(assistantMessage);

                if (!"tool_calls".equals(finishReason) || assistantMessage.getToolCalls() == null) {
                    return parseResponse(assistantMessage.getContent());
                }

                for (OpenAiToolCall toolCall : assistantMessage.getToolCalls()) {
                    String result = executeToolCall(toolCall);
                    messages.add(OpenAiMessage.tool(toolCall.getId(), result));
                    toolCallCount++;
                }
            }

            // Max tool calls reached, do final call without tools
            OpenAiChatResponse finalResponse = openAiClient.chat(messages, null);
            if (finalResponse != null && finalResponse.getChoices() != null && !finalResponse.getChoices().isEmpty()) {
                return parseResponse(finalResponse.getChoices().get(0).getMessage().getContent());
            }

            return fallbackResponse();
        } catch (Exception e) {
            log.error("Chatbot query failed", e);
            return ChatbotResponse.builder()
                    .content("죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.")
                    .build();
        }
    }

    private String executeToolCall(OpenAiToolCall toolCall) {
        try {
            String functionName = toolCall.getFunction().getName();
            if (!"call_spring_api".equals(functionName)) {
                return "{\"error\": \"Unknown function: " + functionName + "\"}";
            }

            ToolCallArguments args = objectMapper.readValue(
                    toolCall.getFunction().getArguments(), ToolCallArguments.class);

            return internalApiClient.call(args.getMethod(), args.getPath(), args.getQueryParams());
        } catch (JsonProcessingException e) {
            log.error("Failed to parse tool call arguments", e);
            return "{\"error\": \"Invalid arguments\"}";
        }
    }

    private ChatbotResponse parseResponse(String content) {
        if (content == null) {
            return fallbackResponse();
        }

        String dataSummary = null;
        String mainContent = content;

        int separatorIdx = content.lastIndexOf("---\ndata_summary:");
        if (separatorIdx == -1) {
            separatorIdx = content.lastIndexOf("---\\ndata_summary:");
        }

        if (separatorIdx >= 0) {
            mainContent = content.substring(0, separatorIdx).trim();
            String afterSep = content.substring(separatorIdx);
            int colonIdx = afterSep.indexOf(":");
            if (colonIdx >= 0) {
                dataSummary = afterSep.substring(colonIdx + 1).trim();
            }
        }

        return ChatbotResponse.builder()
                .content(mainContent)
                .dataSummary(dataSummary)
                .build();
    }

    private ChatbotResponse fallbackResponse() {
        return ChatbotResponse.builder()
                .content("죄송합니다. 응답을 생성할 수 없습니다. 잠시 후 다시 시도해주세요.")
                .build();
    }
}
