package com.bridge.backend.common.security;

import com.bridge.backend.common.api.AppException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.UUID;

public final class SecurityUtils {
    private SecurityUtils() {
    }

    public static AuthPrincipal requirePrincipal() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication instanceof AuthPrincipal principal) {
            return principal;
        }
        throw new AppException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "로그인이 필요합니다.");
    }

    public static UUID currentTenantId() {
        return requirePrincipal().getTenantId();
    }

    public static UUID currentUserId() {
        return requirePrincipal().getUserId();
    }
}
