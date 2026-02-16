package com.bridge.backend.common.security;

import com.bridge.backend.common.model.enums.MemberRole;

import java.util.Set;
import java.util.UUID;

public record AuthContext(UUID userId, UUID tenantId, Set<MemberRole> projectRoles) {
}
