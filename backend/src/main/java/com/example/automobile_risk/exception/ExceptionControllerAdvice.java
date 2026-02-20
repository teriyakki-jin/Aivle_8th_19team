package com.example.automobile_risk.exception;

import io.swagger.v3.oas.annotations.Hidden;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Slf4j
@RestControllerAdvice
@Hidden
public class ExceptionControllerAdvice {

    @ResponseStatus
    @ExceptionHandler(IllegalArgumentException.class)
    public ErrorResponse illegalArgumentExceptionHandler(IllegalArgumentException e) {
        log.error("ExceptionHandler : {}", e);

        return new ErrorResponse("BAD Args", e.getMessage());
    }

    @ResponseStatus
    @ExceptionHandler(IllegalStateException.class)
    public ErrorResponse illegalStateExceptionHandler(IllegalStateException e) {
        log.error("ExceptionHandler : {}", e);

        return new ErrorResponse("BAD State", e.getMessage());
    }

    @ExceptionHandler(EntityNotFoundException.class)
    public ErrorResponse entityNotFoundExceptionHandler(EntityNotFoundException e) {
        log.error("ExceptionHandler : {}", e);

        return new ErrorResponse("Entity Not Found", e.getMessage());
    }

    @ExceptionHandler(DuplicateBomException.class)
    public ErrorResponse duplicateBomExceptionHandler(DuplicateBomException e) {
        log.error("ExceptionHandler : {}", e);

        return new ErrorResponse("Duplicate Bom", e.getMessage());
    }
}
