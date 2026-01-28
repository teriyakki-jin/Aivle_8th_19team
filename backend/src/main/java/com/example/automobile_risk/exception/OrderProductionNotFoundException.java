package com.example.automobile_risk.exception;

public class OrderProductionNotFoundException extends EntityNotFoundException {

    public OrderProductionNotFoundException() {
        super();
    }

    public OrderProductionNotFoundException(Long id) {
        super("OrderProduction not found. id=" + id);
    }

    public OrderProductionNotFoundException(String message) {
        super(message);
    }


    public OrderProductionNotFoundException(String message, Throwable cause) {
        super(message, cause);
    }

    public OrderProductionNotFoundException(Throwable cause) {
        super(cause);
    }

    protected OrderProductionNotFoundException(String message, Throwable cause, boolean enableSuppression, boolean writableStackTrace) {
        super(message, cause, enableSuppression, writableStackTrace);
    }
}
