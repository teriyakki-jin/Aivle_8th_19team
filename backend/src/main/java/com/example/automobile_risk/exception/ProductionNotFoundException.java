package com.example.automobile_risk.exception;

public class ProductionNotFoundException extends EntityNotFoundException {

    public ProductionNotFoundException() {
        super();
    }

    public ProductionNotFoundException(Long id) {
        super("Production not found. id=" + id);
    }

    public ProductionNotFoundException(String message) {
        super(message);
    }


    public ProductionNotFoundException(String message, Throwable cause) {
        super(message, cause);
    }

    public ProductionNotFoundException(Throwable cause) {
        super(cause);
    }

    protected ProductionNotFoundException(String message, Throwable cause, boolean enableSuppression, boolean writableStackTrace) {
        super(message, cause, enableSuppression, writableStackTrace);
    }
}
