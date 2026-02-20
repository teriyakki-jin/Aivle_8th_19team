package com.example.automobile_risk.config;

import com.example.automobile_risk.service.DummyDataGeneratorService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DummyDataRunner implements ApplicationRunner {

    private final DummyDataGeneratorService generator;

    @Value("${dummy.enabled:false}")
    private boolean enabled;

    @Value("${dummy.rows:10000}")
    private int rows;

    @Value("${dummy.lateRate:0.05}")
    private double lateRate;

    @Value("${dummy.seed:42}")
    private long seed;

    @Override
    public void run(ApplicationArguments args) throws Exception {
        if (!enabled) return;
        generator.generate(rows, lateRate, seed);
    }
}
