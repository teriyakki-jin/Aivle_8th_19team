package com.example.automobile_risk.service.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProcessDefectSummaryResponse {

    private String processName;
    private int defectCount;
    private String status; // PASS, WARNING, FAIL

    public static ProcessDefectSummaryResponse of(String processName, int defectCount) {
        String status;
        if (defectCount == 0) {
            status = "PASS";
        } else if (defectCount <= 2) {
            status = "WARNING";
        } else {
            status = "FAIL";
        }

        return ProcessDefectSummaryResponse.builder()
                .processName(processName)
                .defectCount(defectCount)
                .status(status)
                .build();
    }
}
