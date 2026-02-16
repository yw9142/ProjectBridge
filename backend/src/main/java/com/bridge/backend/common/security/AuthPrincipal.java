package com.bridge.backend.common.security;

import lombok.Getter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.Collection;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Getter
public class AuthPrincipal extends AbstractAuthenticationToken {
    private final UUID userId;
    private final UUID tenantId;
    private final Set<String> roles;

    public AuthPrincipal(UUID userId, UUID tenantId, Set<String> roles) {
        super(toAuthorities(roles));
        this.userId = userId;
        this.tenantId = tenantId;
        this.roles = roles;
        setAuthenticated(true);
    }

    private static Collection<SimpleGrantedAuthority> toAuthorities(Set<String> roles) {
        return roles.stream().map(SimpleGrantedAuthority::new).collect(Collectors.toSet());
    }

    @Override
    public Object getCredentials() {
        return "";
    }

    @Override
    public Object getPrincipal() {
        return userId.toString();
    }
}
