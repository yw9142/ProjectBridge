package com.bridge.backend.common.security;

import com.bridge.backend.common.api.AppException;
import com.bridge.backend.config.SecurityProperties;
import io.jsonwebtoken.Claims;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.servlet.HandlerExceptionResolver;

import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JwtAuthenticationFilterTest {

    @Mock
    private JwtService jwtService;
    @Mock
    private HandlerExceptionResolver handlerExceptionResolver;

    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @BeforeEach
    void setUp() {
        jwtAuthenticationFilter = new JwtAuthenticationFilter(jwtService, createAuthCookieService(), handlerExceptionResolver);
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void doesNotAuthenticateWhenOnlyAuthorizationHeaderIsPresent() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/projects");
        request.addHeader(AuthCookieService.APP_HEADER_NAME, "pm");
        request.addHeader(HttpHeaders.AUTHORIZATION, "Bearer legacy-token");
        MockHttpServletResponse response = new MockHttpServletResponse();

        jwtAuthenticationFilter.doFilter(request, response, new MockFilterChain());

        verify(jwtService, never()).parse(any());
        verifyNoInteractions(handlerExceptionResolver);
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    void skipsFilterForActuatorHealth() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/actuator/health");
        MockHttpServletResponse response = new MockHttpServletResponse();

        jwtAuthenticationFilter.doFilter(request, response, new MockFilterChain());

        verify(jwtService, never()).parse(any());
        verifyNoInteractions(handlerExceptionResolver);
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    void rejectsQueryScopeOnRestRequest() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/projects");
        request.addParameter("app", "pm");
        request.setCookies(new jakarta.servlet.http.Cookie(AuthCookieService.PM_ACCESS_COOKIE_NAME, "pm-token"));
        MockHttpServletResponse response = new MockHttpServletResponse();

        jwtAuthenticationFilter.doFilter(request, response, new MockFilterChain());

        ArgumentCaptor<Exception> exceptionCaptor = ArgumentCaptor.forClass(Exception.class);
        verify(handlerExceptionResolver).resolveException(eq(request), eq(response), isNull(), exceptionCaptor.capture());
        assertThat(exceptionCaptor.getValue()).isInstanceOf(AppException.class);
        assertThat(((AppException) exceptionCaptor.getValue()).getCode()).isEqualTo("APP_SCOPE_REQUIRED");
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
        request.addHeader(AuthCookieService.APP_HEADER_NAME, "pm");
        request.setCookies(new jakarta.servlet.http.Cookie(AuthCookieService.PM_ACCESS_COOKIE_NAME, "scoped-token"));
        MockHttpServletResponse response = new MockHttpServletResponse();

        when(jwtService.parse("scoped-token")).thenReturn(claims);
        when(jwtService.isRefreshToken(claims)).thenReturn(false);
        when(jwtService.extractRoles(claims)).thenReturn(Set.of("TENANT_PM_OWNER"));

        jwtAuthenticationFilter.doFilter(request, response, new MockFilterChain());

        verify(jwtService).parse("scoped-token");
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isInstanceOf(AuthPrincipal.class);
        AuthPrincipal principal = (AuthPrincipal) SecurityContextHolder.getContext().getAuthentication();
        assertThat(principal.getUserId()).isEqualTo(userId);
        assertThat(principal.getTenantId()).isEqualTo(tenantId);
        verifyNoInteractions(handlerExceptionResolver);
    }

    @Test
    void authenticatesSseRequestWhenQueryScopeProvided() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        Claims claims = mock(Claims.class);
        when(claims.getSubject()).thenReturn(userId.toString());
        when(claims.get("tenantId", String.class)).thenReturn(tenantId.toString());

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/notifications/stream");
        request.addParameter("app", "pm");
        request.setCookies(new jakarta.servlet.http.Cookie(AuthCookieService.PM_ACCESS_COOKIE_NAME, "sse-token"));
        MockHttpServletResponse response = new MockHttpServletResponse();

        when(jwtService.parse("sse-token")).thenReturn(claims);
        when(jwtService.isRefreshToken(claims)).thenReturn(false);
        when(jwtService.extractRoles(claims)).thenReturn(Set.of("TENANT_PM_OWNER"));

        jwtAuthenticationFilter.doFilter(request, response, new MockFilterChain());

        verify(jwtService).parse("sse-token");
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isInstanceOf(AuthPrincipal.class);
        verifyNoInteractions(handlerExceptionResolver);
    }

    private AuthCookieService createAuthCookieService() {
        JwtProperties jwtProperties = new JwtProperties();
        jwtProperties.setAccessExpirationMinutes(15);
        jwtProperties.setRefreshExpirationDays(30);

        SecurityProperties securityProperties = new SecurityProperties();
        return new AuthCookieService(jwtProperties, securityProperties);
    }
}
