package com.example.automobile_risk.exception;

public class OrderNotFoundException extends EntityNotFoundException {

    public OrderNotFoundException() {
        super();
    }

    public OrderNotFoundException(Long id) {
        super("Order not found. id=" + id);
    }

    public OrderNotFoundException(String message) {
        super(message);
    }


    public OrderNotFoundException(String message, Throwable cause) {
        super(message, cause);
    }

    public OrderNotFoundException(Throwable cause) {
        super(cause);
    }

    protected OrderNotFoundException(String message, Throwable cause, boolean enableSuppression, boolean writableStackTrace) {
        super(message, cause, enableSuppression, writableStackTrace);
    }
}
