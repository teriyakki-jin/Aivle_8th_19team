package com.example.automobile_risk;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

@EnableJpaAuditing
@SpringBootApplication
public class AutomobileRiskApplication {

	public static void main(String[] args) {
		SpringApplication.run(AutomobileRiskApplication.class, args);
	}

}
