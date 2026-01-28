package com.example.automobile_risk.controller.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProductionCompleteForm {

    @NotNull
    private LocalDateTime endDate;
    @NotNull
    private List<@NotBlank String> serialNumbers;
}
