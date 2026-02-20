package com.bridge.backend.common.api;

public record ApiError(boolean success, ErrorBody error) {
    public static ApiError of(String code, String message) {
        return of(code, message, null);
    }

    public static ApiError of(String code, String message, Object details) {
        return new ApiError(false, new ErrorBody(code, message, details));
    }

    public record ErrorBody(String code, String message, Object details) {
    }
}
