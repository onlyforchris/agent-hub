package com.efloow.agenthub.common.exception;

public class BusinessException extends RuntimeException {

    private final String code;

    /**
     * Creates a business exception with a stable error code.
     *
     * @param code stable error code
     * @param message user readable message
     */
    public BusinessException(String code, String message) {
        super(message);
        this.code = code;
    }

    /**
     * Returns the stable error code.
     *
     * @return error code
     */
    public String getCode() {
        return code;
    }
}

