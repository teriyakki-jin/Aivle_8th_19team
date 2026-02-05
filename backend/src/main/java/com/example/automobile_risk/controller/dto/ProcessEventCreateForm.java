package com.example.automobile_risk.controller.dto;

import com.example.automobile_risk.entity.enumclass.EventSource;
import com.example.automobile_risk.entity.enumclass.EventType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ProcessEventCreateForm {

    @NotNull(message = "주문 ID는 필수입니다")
    private Long orderId;

    @NotBlank(message = "공정명은 필수입니다")
    private String process;

    @NotNull(message = "이벤트 유형은 필수입니다")
    private EventType eventType;

    private String eventCode;

    private Integer severity;

    private int qtyAffected;

    private boolean lineHold;

    private EventSource source;

    private String message; // 추가 메시지 (ML 결과 등)
}
