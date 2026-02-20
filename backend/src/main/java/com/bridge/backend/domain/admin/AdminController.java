package com.bridge.backend.domain.admin;

import com.bridge.backend.common.api.ApiSuccess;
import com.bridge.backend.common.model.enums.UserStatus;
import com.bridge.backend.common.security.SecurityUtils;
import com.bridge.backend.common.tenant.AccessGuardService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin")
@Validated
public class AdminController {
    private final AdminService adminService;
    private final AccessGuardService accessGuardService;

    public AdminController(AdminService adminService, AccessGuardService accessGuardService) {
        this.adminService = adminService;
        this.accessGuardService = accessGuardService;
    }

    @PostMapping("/tenants")
    public ApiSuccess<TenantEntity> createTenant(@RequestBody @Valid CreateTenantRequest request) {
        UUID actorId = SecurityUtils.currentUserId();
        accessGuardService.requirePlatformAdmin(actorId);
        return ApiSuccess.of(adminService.createTenant(request.name(), request.slug(), actorId));
    }

    @GetMapping("/tenants")
    public ApiSuccess<List<TenantEntity>> listTenants() {
        accessGuardService.requirePlatformAdmin(SecurityUtils.currentUserId());
        return ApiSuccess.of(adminService.listTenants());
    }

    @GetMapping("/tenants/{tenantId}")
    public ApiSuccess<TenantEntity> getTenant(@PathVariable UUID tenantId) {
        accessGuardService.requirePlatformAdmin(SecurityUtils.currentUserId());
        return ApiSuccess.of(adminService.getTenant(tenantId));
    }

    @PostMapping("/tenants/{tenantId}/pm-users")
    public ApiSuccess<Map<String, Object>> createPmUser(@PathVariable UUID tenantId, @RequestBody @Valid CreatePmUserRequest request) {
        UUID actorId = SecurityUtils.currentUserId();
        accessGuardService.requirePlatformAdmin(actorId);
        var issued = adminService.createPmUser(tenantId, request.email(), request.name(), actorId);
        Map<String, Object> response = new HashMap<>();
        response.put("userId", issued.userId());
        response.put("email", issued.email());
        response.put("status", issued.status());
        response.put("passwordInitialized", issued.passwordInitialized());
        response.put("setupCode", issued.setupCode());
        response.put("setupCodeExpiresAt", issued.setupCodeExpiresAt());
        return ApiSuccess.of(response);
    }

    @GetMapping("/tenants/{tenantId}/pm-users")
    public ApiSuccess<List<Map<String, Object>>> listPmUsers(@PathVariable UUID tenantId) {
        accessGuardService.requirePlatformAdmin(SecurityUtils.currentUserId());
        return ApiSuccess.of(adminService.listPmUsers(tenantId));
    }

    @GetMapping("/tenants/{tenantId}/projects")
    public ApiSuccess<List<Map<String, Object>>> listProjects(@PathVariable UUID tenantId) {
        accessGuardService.requirePlatformAdmin(SecurityUtils.currentUserId());
        return ApiSuccess.of(adminService.listProjects(tenantId).stream()
                .map(project -> {
                    Map<String, Object> row = new HashMap<>();
                    row.put("id", project.getId());
                    row.put("name", project.getName());
                    row.put("description", project.getDescription());
                    row.put("status", project.getStatus());
                    row.put("createdAt", project.getCreatedAt());
                    return row;
                })
                .toList());
    }

    @PatchMapping("/users/{userId}/status")
    public ApiSuccess<Map<String, Object>> updateUserStatus(@PathVariable UUID userId, @RequestBody @Valid UpdateStatusRequest request) {
        accessGuardService.requirePlatformAdmin(SecurityUtils.currentUserId());
        var user = adminService.updateUserStatus(userId, request.status());
        return ApiSuccess.of(Map.of("userId", user.getId(), "status", user.getStatus()));
    }

    @GetMapping("/users/{userId}")
    public ApiSuccess<Map<String, Object>> getUser(@PathVariable UUID userId) {
        accessGuardService.requirePlatformAdmin(SecurityUtils.currentUserId());
        return ApiSuccess.of(adminService.getUserDetail(userId));
    }

    @PostMapping("/users/{userId}/unlock-login")
    public ApiSuccess<Map<String, Object>> unlockLogin(@PathVariable UUID userId) {
        accessGuardService.requirePlatformAdmin(SecurityUtils.currentUserId());
        return ApiSuccess.of(adminService.unlockLogin(userId));
    }

    @PostMapping("/users/{userId}/setup-code/reset")
    public ApiSuccess<Map<String, Object>> resetSetupCode(@PathVariable UUID userId) {
        UUID actorId = SecurityUtils.currentUserId();
        accessGuardService.requirePlatformAdmin(actorId);
        var issued = adminService.resetSetupCode(userId, actorId);
        Map<String, Object> response = new HashMap<>();
        response.put("userId", issued.userId());
        response.put("passwordInitialized", issued.passwordInitialized());
        response.put("setupCode", issued.setupCode());
        response.put("setupCodeExpiresAt", issued.setupCodeExpiresAt());
        return ApiSuccess.of(response);
    }

    public record CreateTenantRequest(@NotBlank String name, @NotBlank String slug) {
    }

    public record CreatePmUserRequest(@Email @NotBlank String email, @NotBlank String name) {
    }

    public record UpdateStatusRequest(@NotNull UserStatus status) {
    }
}
