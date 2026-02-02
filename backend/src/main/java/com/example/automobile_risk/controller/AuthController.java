package com.example.automobile_risk.controller;

import com.example.automobile_risk.dto.LoginRequest;
import com.example.automobile_risk.dto.LoginResponse;
import com.example.automobile_risk.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody LoginRequest request) {
        try {
            authService.register(request);
            return ResponseEntity.status(201).body("User created successfully");
        } catch (RuntimeException e) {
            if (e.getMessage().contains("already exists")) {
                return ResponseEntity.status(409).body(java.util.Map.of("error", "이미 사용 중인 아이디입니다"));
            }
            return ResponseEntity.status(500).body(java.util.Map.of("error", "회원가입에 실패했습니다"));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }
}
