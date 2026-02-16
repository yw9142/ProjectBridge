package com.bridge.backend.domain.admin;

import com.bridge.backend.common.api.AppException;
import com.bridge.backend.common.model.enums.MemberRole;
import com.bridge.backend.common.model.enums.UserStatus;
import com.bridge.backend.domain.auth.UserEntity;
import com.bridge.backend.domain.auth.UserRepository;
import com.bridge.backend.domain.project.ProjectEntity;
import com.bridge.backend.domain.project.ProjectRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class AdminService {
    private final TenantRepository tenantRepository;
    private final TenantMemberRepository tenantMemberRepository;
    private final UserRepository userRepository;
    private final ProjectRepository projectRepository;
    private final PasswordEncoder passwordEncoder;

    public AdminService(TenantRepository tenantRepository,
                        TenantMemberRepository tenantMemberRepository,
                        UserRepository userRepository,
                        ProjectRepository projectRepository,
                        PasswordEncoder passwordEncoder) {
        this.tenantRepository = tenantRepository;
        this.tenantMemberRepository = tenantMemberRepository;
        this.userRepository = userRepository;
        this.projectRepository = projectRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public TenantEntity createTenant(String name, String slug, UUID actorId) {
        tenantRepository.findBySlug(slug).ifPresent(t -> {
            throw new AppException(HttpStatus.CONFLICT, "TENANT_SLUG_DUPLICATE", "이미 사용 중인 slug 입니다.");
        });
        TenantEntity tenant = new TenantEntity();
        tenant.setName(name);
        tenant.setSlug(slug);
        tenant.setCreatedBy(actorId);
        tenant.setUpdatedBy(actorId);
        return tenantRepository.save(tenant);
    }

    @Transactional(readOnly = true)
    public List<TenantEntity> listTenants() {
        return tenantRepository.findAll().stream()
                .filter(tenant -> tenant.getDeletedAt() == null)
                .sorted(Comparator.comparing(TenantEntity::getCreatedAt).reversed())
                .toList();
    }

    @Transactional(readOnly = true)
    public TenantEntity getTenant(UUID tenantId) {
        return tenantRepository.findById(tenantId)
                .filter(tenant -> tenant.getDeletedAt() == null)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "TENANT_NOT_FOUND", "테넌트를 찾을 수 없습니다."));
    }

    @Transactional
    public UserEntity createPmUser(UUID tenantId, String email, String name, UUID actorId) {
        getTenant(tenantId);

        UserEntity user = userRepository.findByEmailAndDeletedAtIsNull(email).orElseGet(() -> {
            UserEntity created = new UserEntity();
            created.setEmail(email);
            created.setName(name);
            created.setPasswordHash(passwordEncoder.encode("TempPassword!123"));
            created.setStatus(UserStatus.INVITED);
            created.setCreatedBy(actorId);
            created.setUpdatedBy(actorId);
            return userRepository.save(created);
        });

        boolean exists = tenantMemberRepository.findByTenantIdAndUserIdAndDeletedAtIsNull(tenantId, user.getId()).isPresent();
        if (!exists) {
            TenantMemberEntity member = new TenantMemberEntity();
            member.setTenantId(tenantId);
            member.setUserId(user.getId());
            member.setRole(MemberRole.PM_OWNER);
            member.setCreatedBy(actorId);
            member.setUpdatedBy(actorId);
            tenantMemberRepository.save(member);
        }

        return user;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listPmUsers(UUID tenantId) {
        getTenant(tenantId);

        return tenantMemberRepository.findByTenantIdAndDeletedAtIsNull(tenantId).stream()
                .filter(member -> member.getRole() == MemberRole.PM_OWNER || member.getRole() == MemberRole.PM_MEMBER)
                .map(member -> {
                    UserEntity user = requireActiveUser(member.getUserId());
                    Map<String, Object> row = new HashMap<>();
                    row.put("userId", user.getId());
                    row.put("email", user.getEmail());
                    row.put("name", user.getName());
                    row.put("status", user.getStatus());
                    row.put("role", member.getRole());
                    row.put("lastLoginAt", user.getLastLoginAt());
                    return row;
                })
                .sorted(Comparator.comparing(row -> String.valueOf(row.get("email"))))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ProjectEntity> listProjects(UUID tenantId) {
        getTenant(tenantId);
        return projectRepository.findByTenantIdAndDeletedAtIsNull(tenantId).stream()
                .sorted(Comparator.comparing(ProjectEntity::getCreatedAt).reversed())
                .toList();
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getUserDetail(UUID userId) {
        UserEntity user = requireActiveUser(userId);

        List<TenantMemberEntity> memberships = tenantMemberRepository.findByUserIdAndDeletedAtIsNull(userId);
        Map<UUID, TenantEntity> tenantsById = tenantRepository.findAllById(
                        memberships.stream().map(TenantMemberEntity::getTenantId).collect(Collectors.toSet()))
                .stream()
                .filter(tenant -> tenant.getDeletedAt() == null)
                .collect(Collectors.toMap(TenantEntity::getId, Function.identity()));

        List<Map<String, Object>> tenantMemberships = memberships.stream()
                .filter(member -> tenantsById.containsKey(member.getTenantId()))
                .map(member -> {
                    TenantEntity tenant = tenantsById.get(member.getTenantId());
                    return Map.<String, Object>of(
                            "tenantId", tenant.getId(),
                            "tenantName", tenant.getName(),
                            "tenantSlug", tenant.getSlug(),
                            "role", member.getRole().name()
                    );
                })
                .sorted(Comparator.comparing(row -> String.valueOf(row.get("tenantName"))))
                .toList();

        return Map.of(
                "userId", user.getId(),
                "email", user.getEmail(),
                "name", user.getName(),
                "status", user.getStatus(),
                "isPlatformAdmin", user.isPlatformAdmin(),
                "lastLoginAt", user.getLastLoginAt(),
                "memberships", tenantMemberships
        );
    }

    @Transactional
    public UserEntity updateUserStatus(UUID userId, UserStatus status) {
        UserEntity user = requireActiveUser(userId);
        user.setStatus(status);
        return userRepository.save(user);
    }

    private UserEntity requireActiveUser(UUID userId) {
        return userRepository.findByIdAndDeletedAtIsNull(userId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다."));
    }
}
