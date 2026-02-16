package com.bridge.backend.common.api;

public record ApiError(boolean success, String code, String message, Object details) {
    public static ApiError of(String code, String message) {
        return new ApiError(false, code, message, null);
    }
}
