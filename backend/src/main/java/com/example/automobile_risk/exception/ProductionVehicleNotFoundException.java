package com.example.automobile_risk.exception;

public class ProductionVehicleNotFoundException extends EntityNotFoundException {

    public ProductionVehicleNotFoundException() {
        super();
    }

    public ProductionVehicleNotFoundException(Long id) {
        super("ProductionVehicle not found. id=" + id);
    }

    public ProductionVehicleNotFoundException(String message) {
        super(message);
    }


    public ProductionVehicleNotFoundException(String message, Throwable cause) {
        super(message, cause);
    }

    public ProductionVehicleNotFoundException(Throwable cause) {
        super(cause);
    }

    protected ProductionVehicleNotFoundException(String message, Throwable cause, boolean enableSuppression, boolean writableStackTrace) {
        super(message, cause, enableSuppression, writableStackTrace);
    }
}
