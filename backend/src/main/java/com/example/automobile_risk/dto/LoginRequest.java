package com.example.automobile_risk.dto;

import lombok.*;
import com.example.automobile_risk.entity.enumclass.UserRole;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LoginRequest {
    private String username;
    private String password;
    private UserRole role;
}
