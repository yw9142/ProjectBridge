package com.bridge.backend.domain.project;

import com.bridge.backend.common.api.ApiSuccess;
import com.bridge.backend.common.model.enums.MemberRole;
import com.bridge.backend.common.model.enums.ProjectStatus;
import com.bridge.backend.common.security.SecurityUtils;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@Validated
public class ProjectController {
    private final ProjectService projectService;

    public ProjectController(ProjectService projectService) {
        this.projectService = projectService;
    }

    @GetMapping("/api/projects")
    public ApiSuccess<List<ProjectEntity>> listProjects() {
        return ApiSuccess.of(projectService.list(SecurityUtils.requirePrincipal()));
    }

    @PostMapping("/api/projects")
    public ApiSuccess<ProjectEntity> createProject(@RequestBody @Valid CreateProjectRequest request) {
        return ApiSuccess.of(projectService.create(SecurityUtils.requirePrincipal(), request.name(), request.description()));
    }

    @GetMapping("/api/projects/{projectId}")
    public ApiSuccess<ProjectEntity> getProject(@PathVariable UUID projectId) {
        return ApiSuccess.of(projectService.get(SecurityUtils.requirePrincipal(), projectId));
    }

    @GetMapping("/api/projects/{projectId}/my-role")
    public ApiSuccess<Map<String, String>> myProjectRole(@PathVariable UUID projectId) {
        var role = projectService.myRole(SecurityUtils.requirePrincipal(), projectId);
        return ApiSuccess.of(Map.of("role", role.name()));
    }

    @PatchMapping("/api/projects/{projectId}")
    public ApiSuccess<ProjectEntity> updateProject(@PathVariable UUID projectId, @RequestBody UpdateProjectRequest request) {
        return ApiSuccess.of(projectService.update(SecurityUtils.requirePrincipal(), projectId, request.name(), request.description(), request.status()));
    }

    @GetMapping("/api/projects/{projectId}/members")
    public ApiSuccess<List<ProjectService.ProjectMemberAccount>> projectMembers(@PathVariable UUID projectId) {
        return ApiSuccess.of(projectService.members(SecurityUtils.requirePrincipal(), projectId));
    }

    @PostMapping("/api/projects/{projectId}/members/invite")
    public ApiSuccess<ProjectService.ProjectMemberAccount> invite(@PathVariable UUID projectId, @RequestBody @Valid InviteRequest request) {
        return ApiSuccess.of(projectService.invite(
                SecurityUtils.requirePrincipal(),
                projectId,
                request.loginId(),
                request.name(),
                request.role()
        ));
    }

    @PostMapping("/api/projects/{projectId}/members/{memberId}/setup-code/reset")
    public ApiSuccess<ProjectService.ProjectMemberAccount> resetSetupCode(@PathVariable UUID projectId, @PathVariable UUID memberId) {
        return ApiSuccess.of(projectService.resetSetupCode(SecurityUtils.requirePrincipal(), projectId, memberId));
    }

    @PatchMapping("/api/projects/{projectId}/members/{memberId}")
    public ApiSuccess<ProjectMemberEntity> updateMemberRole(@PathVariable UUID projectId,
                                                             @PathVariable UUID memberId,
                                                             @RequestBody @Valid UpdateMemberRequest request) {
        return ApiSuccess.of(projectService.updateMemberRole(SecurityUtils.requirePrincipal(), projectId, memberId, request.role()));
    }

    @PatchMapping("/api/projects/{projectId}/members/{memberId}/account")
    public ApiSuccess<ProjectService.ProjectMemberAccount> updateMemberAccount(@PathVariable UUID projectId,
                                                                               @PathVariable UUID memberId,
                                                                               @RequestBody @Valid UpdateMemberAccountRequest request) {
        return ApiSuccess.of(projectService.updateMemberAccount(
                SecurityUtils.requirePrincipal(),
                projectId,
                memberId,
                request.loginId(),
                request.password()
        ));
    }

    @DeleteMapping("/api/projects/{projectId}/members/{memberId}")
    public ApiSuccess<Map<String, Object>> removeMember(@PathVariable UUID projectId, @PathVariable UUID memberId) {
        return ApiSuccess.of(projectService.removeMember(SecurityUtils.requirePrincipal(), projectId, memberId));
    }

    public record CreateProjectRequest(@NotBlank String name, String description) {
    }

    public record UpdateProjectRequest(String name, String description, ProjectStatus status) {
    }

    public record InviteRequest(@Email @NotBlank String loginId, String name, MemberRole role) {
    }

    public record UpdateMemberRequest(@NotNull MemberRole role) {
    }

    public record UpdateMemberAccountRequest(String loginId, String password) {
    }
}
