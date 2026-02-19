package com.bridge.backend.domain.auth;

import com.bridge.backend.common.api.ApiSuccess;
import com.bridge.backend.common.security.SecurityUtils;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
@Validated
public class AuthController {
    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public ApiSuccess<Map<String, Object>> login(@RequestBody @Valid LoginRequest request) {
        return ApiSuccess.of(authService.login(request.email(), request.password(), request.tenantSlug()));
    }

    @PostMapping("/refresh")
    public ApiSuccess<Map<String, Object>> refresh(@RequestBody @Valid RefreshRequest request) {
        return ApiSuccess.of(authService.refresh(request.refreshToken()));
    }

    @PostMapping("/logout")
    public ApiSuccess<Map<String, Object>> logout(@RequestBody @Valid LogoutRequest request) {
        authService.logout(request.refreshToken());
        return ApiSuccess.of(Map.of("loggedOut", true));
    }

    @GetMapping("/me")
    public ApiSuccess<Map<String, Object>> me() {
        return ApiSuccess.of(authService.me(SecurityUtils.currentUserId()));
    }

    @PostMapping("/switch-tenant")
    public ApiSuccess<Map<String, Object>> switchTenant(@RequestBody @Valid SwitchTenantRequest request) {
        return ApiSuccess.of(authService.switchTenant(SecurityUtils.currentUserId(), request.tenantId()));
    }

    public record LoginRequest(@Email @NotBlank String email, @NotBlank String password, String tenantSlug) {
    }

    public record RefreshRequest(@NotBlank String refreshToken) {
    }

    public record LogoutRequest(@NotBlank String refreshToken) {
    }

    public record SwitchTenantRequest(@NotNull UUID tenantId) {
    }
}
