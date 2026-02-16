package com.bridge.backend.common.tenant;

import com.bridge.backend.common.api.AppException;
import com.bridge.backend.common.model.enums.MemberRole;
import com.bridge.backend.common.security.AuthPrincipal;
import com.bridge.backend.domain.auth.UserEntity;
import com.bridge.backend.domain.auth.UserRepository;
import com.bridge.backend.domain.project.ProjectEntity;
import com.bridge.backend.domain.project.ProjectMemberEntity;
import com.bridge.backend.domain.project.ProjectMemberRepository;
import com.bridge.backend.domain.project.ProjectRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.Set;
import java.util.UUID;

@Service
public class AccessGuardService {
    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final UserRepository userRepository;

    public AccessGuardService(ProjectRepository projectRepository,
                              ProjectMemberRepository projectMemberRepository,
                              UserRepository userRepository) {
        this.projectRepository = projectRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.userRepository = userRepository;
    }

    public UserEntity requireUser(UUID userId) {
        return userRepository.findById(userId)
                .filter(u -> u.getDeletedAt() == null)
                .orElseThrow(() -> new AppException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "사용자를 찾을 수 없습니다."));
    }

    public void requirePlatformAdmin(UUID userId) {
        UserEntity user = requireUser(userId);
        if (!user.isPlatformAdmin()) {
            throw new AppException(HttpStatus.FORBIDDEN, "FORBIDDEN", "플랫폼 관리자 권한이 필요합니다.");
        }
    }

    public ProjectEntity requireProjectInTenant(UUID projectId, UUID tenantId) {
        ProjectEntity project = projectRepository.findById(projectId)
                .filter(p -> p.getDeletedAt() == null)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "PROJECT_NOT_FOUND", "프로젝트를 찾을 수 없습니다."));
        if (!tenantId.equals(project.getTenantId())) {
            throw new AppException(HttpStatus.FORBIDDEN, "TENANT_MISMATCH", "테넌트가 일치하지 않습니다.");
        }
        return project;
    }

    public ProjectMemberEntity requireProjectMember(UUID projectId, UUID userId, UUID tenantId) {
        requireProjectInTenant(projectId, tenantId);
        UserEntity user = requireUser(userId);
        if (user.isPlatformAdmin()) {
            return virtualPmOwnerMembership(projectId, userId, tenantId);
        }
        ProjectMemberEntity member = projectMemberRepository.findByProjectIdAndUserIdAndDeletedAtIsNull(projectId, userId)
                .orElseThrow(() -> new AppException(HttpStatus.FORBIDDEN, "PROJECT_MEMBER_REQUIRED", "프로젝트 멤버가 아닙니다."));
        if (!tenantId.equals(member.getTenantId())) {
            throw new AppException(HttpStatus.FORBIDDEN, "TENANT_MISMATCH", "테넌트가 일치하지 않습니다.");
        }
        return member;
    }

    public ProjectMemberEntity requireProjectMemberRole(UUID projectId, UUID userId, UUID tenantId, Set<MemberRole> allowedRoles) {
        requireProjectInTenant(projectId, tenantId);
        UserEntity user = requireUser(userId);
        if (user.isPlatformAdmin()) {
            return virtualPmOwnerMembership(projectId, userId, tenantId);
        }
        ProjectMemberEntity member = requireProjectMember(projectId, userId, tenantId);
        if (!allowedRoles.contains(member.getRole())) {
            throw new AppException(HttpStatus.FORBIDDEN, "ROLE_FORBIDDEN", "권한이 부족합니다.");
        }
        return member;
    }

    private ProjectMemberEntity virtualPmOwnerMembership(UUID projectId, UUID userId, UUID tenantId) {
        ProjectMemberEntity member = new ProjectMemberEntity();
        member.setProjectId(projectId);
        member.setUserId(userId);
        member.setTenantId(tenantId);
        member.setRole(MemberRole.PM_OWNER);
        return member;
    }

    public void requireTenantMatch(AuthPrincipal principal, UUID tenantId) {
        if (!principal.getTenantId().equals(tenantId)) {
            throw new AppException(HttpStatus.FORBIDDEN, "TENANT_MISMATCH", "요청 테넌트가 인증 테넌트와 다릅니다.");
        }
    }
}
