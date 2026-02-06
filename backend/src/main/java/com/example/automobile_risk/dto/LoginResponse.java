package com.example.automobile_risk.dto;

import lombok.*;
import com.example.automobile_risk.entity.enumclass.UserRole;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LoginResponse {
    private String token;
    private String username;
    private UserRole role;
}
