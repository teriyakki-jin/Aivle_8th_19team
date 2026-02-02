package com.example.automobile_risk.exception;

public class ProcessExecutionFileNotFoundException extends EntityNotFoundException {

    public ProcessExecutionFileNotFoundException() {
        super();
    }

    public ProcessExecutionFileNotFoundException(Long id) {
        super("ProcessExecutionFile not found. id=" + id);
    }

    public ProcessExecutionFileNotFoundException(String message) {
        super(message);
    }


    public ProcessExecutionFileNotFoundException(String message, Throwable cause) {
        super(message, cause);
    }

    public ProcessExecutionFileNotFoundException(Throwable cause) {
        super(cause);
    }

    protected ProcessExecutionFileNotFoundException(String message, Throwable cause, boolean enableSuppression, boolean writableStackTrace) {
        super(message, cause, enableSuppression, writableStackTrace);
    }
}
