package com.example.automobile_risk.repository;

import com.example.automobile_risk.entity.ProcessExecutionFile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProcessExecutionFileRepository extends JpaRepository<ProcessExecutionFile, Long> {

    List<ProcessExecutionFile> findByProcessExecutionId(Long processExecutionId);
}
