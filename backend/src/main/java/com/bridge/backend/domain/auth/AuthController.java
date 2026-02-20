package com.bridge.backend.domain.auth;

import com.bridge.backend.common.api.ApiSuccess;
import com.bridge.backend.common.security.AuthCookieService;
import com.bridge.backend.common.security.SecurityUtils;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
@Validated
public class AuthController {
    private final AuthService authService;
    private final AuthCookieService authCookieService;

    public AuthController(AuthService authService, AuthCookieService authCookieService) {
        this.authService = authService;
        this.authCookieService = authCookieService;
    }

    @PostMapping("/login")
    public ApiSuccess<Map<String, Object>> login(@RequestBody @Valid LoginRequest request,
                                                 HttpServletRequest httpRequest,
                                                 HttpServletResponse httpResponse) {
        Map<String, Object> result = authService.login(request.email(), request.password(), request.tenantSlug());
        if (Boolean.TRUE.equals(result.get("requiresTenantSelection"))) {
            return ApiSuccess.of(result);
        }

        String accessToken = (String) result.get("accessToken");
        String refreshToken = (String) result.get("refreshToken");
        authCookieService.writeAuthCookies(httpRequest, httpResponse, accessToken, refreshToken);

        Map<String, Object> response = new HashMap<>(result);
        response.remove("accessToken");
        response.remove("refreshToken");
        return ApiSuccess.of(response);
    }

    @PostMapping("/refresh")
    public ApiSuccess<Map<String, Object>> refresh(HttpServletRequest httpRequest,
                                                   HttpServletResponse httpResponse) {
        String refreshToken = authCookieService.readRefreshToken(httpRequest).orElse(null);
        Map<String, Object> refreshed = authService.refresh(refreshToken);
        authCookieService.writeAuthCookies(httpRequest, httpResponse,
                String.valueOf(refreshed.get("accessToken")), String.valueOf(refreshed.get("refreshToken")));
        return ApiSuccess.of(Map.of("refreshed", true));
    }

    @PostMapping("/logout")
    public ApiSuccess<Map<String, Object>> logout(HttpServletRequest httpRequest,
                                                  HttpServletResponse httpResponse) {
        authCookieService.readRefreshToken(httpRequest).ifPresent(authService::logout);
        authCookieService.clearAuthCookies(httpRequest, httpResponse);
        return ApiSuccess.of(Map.of("loggedOut", true));
    }

    @GetMapping("/me")
    public ApiSuccess<Map<String, Object>> me() {
        var principal = SecurityUtils.requirePrincipal();
        Map<String, Object> me = new HashMap<>(authService.me(principal.getUserId()));
        me.put("roles", principal.getRoles());
        me.put("tenantRole", resolveTenantRole(principal.getRoles()));
        return ApiSuccess.of(me);
    }

    @PostMapping("/switch-tenant")
    public ApiSuccess<Map<String, Object>> switchTenant(@RequestBody @Valid SwitchTenantRequest request,
                                                        HttpServletRequest httpRequest,
                                                        HttpServletResponse httpResponse) {
        Map<String, Object> result = authService.switchTenant(SecurityUtils.currentUserId(), request.tenantId());
        authCookieService.writeAuthCookies(httpRequest, httpResponse,
                String.valueOf(result.get("accessToken")), String.valueOf(result.get("refreshToken")));
        Map<String, Object> response = new HashMap<>(result);
        response.remove("accessToken");
        response.remove("refreshToken");
        return ApiSuccess.of(response);
    }

    @PostMapping("/first-password")
    public ApiSuccess<Map<String, Object>> firstPassword(@RequestBody @Valid FirstPasswordRequest request) {
        return ApiSuccess.of(authService.setupFirstPassword(request.email(), request.setupCode(), request.newPassword()));
    }

    public record LoginRequest(@Email @NotBlank String email, @NotBlank String password, String tenantSlug) {
    }

    public record SwitchTenantRequest(@NotNull UUID tenantId) {
    }

    public record FirstPasswordRequest(@Email @NotBlank String email,
                                       @NotBlank String setupCode,
                                       @NotBlank String newPassword) {
    }

    private String resolveTenantRole(Set<String> roles) {
        for (String role : roles) {
            if (role != null && role.startsWith("TENANT_")) {
                return role.substring("TENANT_".length());
            }
        }
        return null;
    }
}
