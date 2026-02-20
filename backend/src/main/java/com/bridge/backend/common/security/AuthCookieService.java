package com.bridge.backend.common.security;

import com.bridge.backend.common.api.AppException;
import com.bridge.backend.config.SecurityProperties;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Locale;
import java.util.Optional;

@Service
public class AuthCookieService {
    public static final String APP_HEADER_NAME = "X-Bridge-App";
    private static final String APP_QUERY_PARAM = "app";
    private static final String SSE_STREAM_PATH = "/api/notifications/stream";
    private static final String APP_SCOPE_REQUIRED_CODE = "APP_SCOPE_REQUIRED";
    private static final String APP_SCOPE_REQUIRED_MESSAGE = "요청 앱 스코프가 필요합니다.";

    private static final String APP_PM = "pm";
    private static final String APP_CLIENT = "client";
    private static final String APP_ADMIN = "admin";

    public static final String PM_ACCESS_COOKIE_NAME = "bridge_pm_access_token";
    public static final String PM_REFRESH_COOKIE_NAME = "bridge_pm_refresh_token";
    public static final String CLIENT_ACCESS_COOKIE_NAME = "bridge_client_access_token";
    public static final String CLIENT_REFRESH_COOKIE_NAME = "bridge_client_refresh_token";
    public static final String ADMIN_ACCESS_COOKIE_NAME = "bridge_admin_access_token";
    public static final String ADMIN_REFRESH_COOKIE_NAME = "bridge_admin_refresh_token";

    private final JwtProperties jwtProperties;
    private final SecurityProperties securityProperties;

    public AuthCookieService(JwtProperties jwtProperties, SecurityProperties securityProperties) {
        this.jwtProperties = jwtProperties;
        this.securityProperties = securityProperties;
    }

    public void writeAuthCookies(HttpServletRequest request, HttpServletResponse response, String accessToken, String refreshToken) {
        CookieNames cookieNames = requireCookieNames(request);
        response.addHeader(HttpHeaders.SET_COOKIE, buildCookie(cookieNames.accessCookieName(), accessToken,
                Duration.ofMinutes(jwtProperties.getAccessExpirationMinutes()), request).toString());
        response.addHeader(HttpHeaders.SET_COOKIE, buildCookie(cookieNames.refreshCookieName(), refreshToken,
                Duration.ofDays(jwtProperties.getRefreshExpirationDays()), request).toString());
    }

    public void clearAuthCookies(HttpServletRequest request, HttpServletResponse response) {
        CookieNames cookieNames = requireCookieNames(request);
        response.addHeader(HttpHeaders.SET_COOKIE, buildCookie(cookieNames.accessCookieName(), "",
                Duration.ZERO, request).toString());
        response.addHeader(HttpHeaders.SET_COOKIE, buildCookie(cookieNames.refreshCookieName(), "",
                Duration.ZERO, request).toString());
    }

    public Optional<String> readAccessToken(HttpServletRequest request) {
        CookieNames cookieNames = requireCookieNames(request);
        return readCookie(request, cookieNames.accessCookieName());
    }

    public Optional<String> readRefreshToken(HttpServletRequest request) {
        CookieNames cookieNames = requireCookieNames(request);
        return readCookie(request, cookieNames.refreshCookieName());
    }

    public Optional<String> resolveAppScope(HttpServletRequest request) {
        Optional<String> appScope = normalizeScope(request.getHeader(APP_HEADER_NAME));
        if (appScope.isEmpty() && isSseScopeFallbackAllowed(request)) {
            appScope = normalizeScope(request.getParameter(APP_QUERY_PARAM));
        }
        return appScope.flatMap(scope -> toCookieNames(scope).map(ignored -> scope));
    }

    private Optional<String> readCookie(HttpServletRequest request, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return Optional.empty();
        }
        for (Cookie cookie : cookies) {
            if (name.equals(cookie.getName()) && cookie.getValue() != null && !cookie.getValue().isBlank()) {
                return Optional.of(cookie.getValue());
            }
        }
        return Optional.empty();
    }

    private ResponseCookie buildCookie(String name, String value, Duration maxAge, HttpServletRequest request) {
        ResponseCookie.ResponseCookieBuilder builder = ResponseCookie.from(name, value)
                .path("/")
                .httpOnly(true)
                .secure(resolveSecure(request))
                .sameSite("Lax")
                .maxAge(maxAge);
        String domain = securityProperties.getAuthCookieDomain();
        if (domain != null && !domain.isBlank()) {
            builder.domain(domain);
        }
        return builder.build();
    }

    private boolean resolveSecure(HttpServletRequest request) {
        if (request.isSecure()) {
            return true;
        }
        String forwardedProto = request.getHeader("X-Forwarded-Proto");
        return forwardedProto != null && forwardedProto.equalsIgnoreCase("https");
    }

    private Optional<CookieNames> resolveCookieNames(HttpServletRequest request) {
        return resolveAppScope(request).flatMap(this::toCookieNames);
    }

    private CookieNames requireCookieNames(HttpServletRequest request) {
        return resolveCookieNames(request)
                .orElseThrow(this::appScopeRequiredException);
    }

    private Optional<CookieNames> toCookieNames(String appScope) {
        return switch (appScope) {
            case APP_PM -> Optional.of(new CookieNames(PM_ACCESS_COOKIE_NAME, PM_REFRESH_COOKIE_NAME));
            case APP_CLIENT -> Optional.of(new CookieNames(CLIENT_ACCESS_COOKIE_NAME, CLIENT_REFRESH_COOKIE_NAME));
            case APP_ADMIN -> Optional.of(new CookieNames(ADMIN_ACCESS_COOKIE_NAME, ADMIN_REFRESH_COOKIE_NAME));
            default -> Optional.empty();
        };
    }

    private AppException appScopeRequiredException() {
        return new AppException(HttpStatus.BAD_REQUEST, APP_SCOPE_REQUIRED_CODE, APP_SCOPE_REQUIRED_MESSAGE);
    }

    private boolean isSseScopeFallbackAllowed(HttpServletRequest request) {
        return SSE_STREAM_PATH.equals(normalizePath(request));
    }

    private String normalizePath(HttpServletRequest request) {
        String uri = request.getRequestURI();
        if (uri == null || uri.isBlank()) {
            return "/";
        }

        String contextPath = request.getContextPath();
        if (contextPath != null && !contextPath.isBlank() && uri.startsWith(contextPath)) {
            uri = uri.substring(contextPath.length());
        }

        String normalized = uri.replaceAll("/{2,}", "/");
        if (normalized.isEmpty()) {
            return "/";
        }
        if (normalized.length() > 1 && normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        return normalized;
    }

    private Optional<String> normalizeScope(String value) {
        if (value == null || value.isBlank()) {
            return Optional.empty();
        }
        return Optional.of(value.trim().toLowerCase(Locale.ROOT));
    }

    private record CookieNames(String accessCookieName, String refreshCookieName) {
    }
}
