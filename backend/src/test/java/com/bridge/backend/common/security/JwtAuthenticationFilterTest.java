package com.bridge.backend.common.security;

import io.jsonwebtoken.Claims;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JwtAuthenticationFilterTest {

    @Mock
    private JwtService jwtService;
    @Mock
    private AuthCookieService authCookieService;

    @InjectMocks
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void doesNotAuthenticateWhenOnlyAuthorizationHeaderIsPresent() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/projects");
        request.addHeader(HttpHeaders.AUTHORIZATION, "Bearer legacy-token");
        MockHttpServletResponse response = new MockHttpServletResponse();

        when(authCookieService.readAccessToken(any())).thenReturn(Optional.empty());

        jwtAuthenticationFilter.doFilter(request, response, new MockFilterChain());

        verify(authCookieService).readAccessToken(request);
        verify(jwtService, never()).parse(any());
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    void authenticatesWhenScopedCookieTokenExists() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        Claims claims = mock(Claims.class);
        when(claims.getSubject()).thenReturn(userId.toString());
        when(claims.get("tenantId", String.class)).thenReturn(tenantId.toString());

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/projects");
        MockHttpServletResponse response = new MockHttpServletResponse();

        when(authCookieService.readAccessToken(any())).thenReturn(Optional.of("scoped-token"));
        when(jwtService.parse("scoped-token")).thenReturn(claims);
        when(jwtService.isRefreshToken(claims)).thenReturn(false);
        when(jwtService.extractRoles(claims)).thenReturn(Set.of("TENANT_PM_OWNER"));

        jwtAuthenticationFilter.doFilter(request, response, new MockFilterChain());

        verify(jwtService).parse("scoped-token");
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isInstanceOf(AuthPrincipal.class);
        AuthPrincipal principal = (AuthPrincipal) SecurityContextHolder.getContext().getAuthentication();
        assertThat(principal.getUserId()).isEqualTo(userId);
        assertThat(principal.getTenantId()).isEqualTo(tenantId);
    }
}
