package com.example.automobile_risk.security;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final UserDetailsServiceImpl userDetailsService;
    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    @Bean
    public DaoAuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider authProvider = new DaoAuthenticationProvider();
        authProvider.setUserDetailsService(userDetailsService);
        authProvider.setPasswordEncoder(passwordEncoder());
        return authProvider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authConfig) throws Exception {
        return authConfig.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/actuator/**").permitAll() // ALB health check
                        .requestMatchers("/api/v1/auth/**").permitAll()
                        .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/v1/board/**").permitAll()
                        .requestMatchers("/dashboard/**").permitAll()   // Dashboard is public as per current FE
                        .requestMatchers("/api/v1/dashboard/**").permitAll() // Dashboard is public as per current FE
                        .requestMatchers("/api/v1/**").permitAll() // 모두 열어둠
                        .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/v1/vehicle-model/**")
                        .hasAnyRole("ADMIN", "PRODUCTION_MANAGER")
                        .requestMatchers("/dashboard/**").permitAll()   // FE route
                        .requestMatchers("/api/v1/chatbot/**").permitAll() // Chatbot is public
                        .requestMatchers("/swagger-ui/**").permitAll() // Swagger
                        .requestMatchers("/v3/api-docs/**").permitAll() // Swagger
                        .requestMatchers("/actuator/health").permitAll()
                        .requestMatchers("/actuator/**").permitAll()

                        // Production manager scope
                        .requestMatchers(
                                "/api/v1/order/**",
                                "/api/v1/production/**",
                                "/api/v1/process-execution/**",
                                "/api/v1/process-execution-file/**",
                                "/api/v1/process-type/**",
                                "/api/v1/order-productions/**",
                                "/api/v1/inventory/**"
                        ).hasAnyRole("ADMIN", "PRODUCTION_MANAGER")

                        // Process manager (anomaly detection) scope
                        .requestMatchers(
                                "/api/v1/defect-summary/**",
                                "/api/v1/process-events/**",
                                "/api/v1/ml/**",
                                "/api/paint-analysis/**",
                                "/api/v1/dashboard/**",
                                "/api/v1/delay-prediction/**",
                                "/api/v1/duedate-predictions/**"
                        ).hasAnyRole("ADMIN", "PROCESS_MANAGER")

                        // Board write actions require login
                        .requestMatchers(
                                org.springframework.http.HttpMethod.POST, "/api/v1/board/**")
                        .hasAnyRole("ADMIN", "PRODUCTION_MANAGER", "PROCESS_MANAGER")
                        .requestMatchers(
                                org.springframework.http.HttpMethod.PUT, "/api/v1/board/**")
                        .hasAnyRole("ADMIN", "PRODUCTION_MANAGER", "PROCESS_MANAGER")
                        .requestMatchers(
                                org.springframework.http.HttpMethod.PATCH, "/api/v1/board/**")
                        .hasAnyRole("ADMIN", "PRODUCTION_MANAGER", "PROCESS_MANAGER")
                        .requestMatchers(
                                org.springframework.http.HttpMethod.DELETE, "/api/v1/board/**")
                        .hasAnyRole("ADMIN", "PRODUCTION_MANAGER", "PROCESS_MANAGER")

                        // Everything else: admin only
                        .anyRequest().hasRole("ADMIN"));

        http.authenticationProvider(authenticationProvider());
        http.addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(Arrays.asList("*"));
        configuration.setAllowedMethods(Arrays.asList("GET", "PATCH", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList("Authorization", "Content-Type"));
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
