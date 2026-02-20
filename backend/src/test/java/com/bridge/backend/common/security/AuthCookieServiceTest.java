package com.bridge.backend.common.security;

import com.bridge.backend.common.api.AppException;
import com.bridge.backend.config.SecurityProperties;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AuthCookieServiceTest {

    @Test
    void readAccessTokenUsesScopedCookieFromHeader() {
        AuthCookieService service = createService();
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/projects");
        request.addHeader(AuthCookieService.APP_HEADER_NAME, "pm");
        request.setCookies(new Cookie(AuthCookieService.PM_ACCESS_COOKIE_NAME, "pm-token"));

        assertThat(service.readAccessToken(request)).contains("pm-token");
    }

    @Test
    void readAccessTokenRejectsMissingScope() {
        AuthCookieService service = createService();
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/projects");
        request.setCookies(new Cookie("bridge_access_token", "legacy-token"));

        assertThatThrownBy(() -> service.readAccessToken(request))
                .isInstanceOf(AppException.class)
                .extracting("code")
                .isEqualTo("APP_SCOPE_REQUIRED");
    }

    @Test
    void readAccessTokenRejectsQueryScopeOnRestRequest() {
        AuthCookieService service = createService();
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/projects");
        request.addParameter("app", "pm");
        request.setCookies(new Cookie(AuthCookieService.PM_ACCESS_COOKIE_NAME, "pm-token"));

        assertThatThrownBy(() -> service.readAccessToken(request))
                .isInstanceOf(AppException.class)
                .extracting("code")
                .isEqualTo("APP_SCOPE_REQUIRED");
    }

    @Test
    void readAccessTokenAllowsQueryScopeOnSseStream() {
        AuthCookieService service = createService();
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/notifications/stream");
        request.addParameter("app", "pm");
        request.setCookies(new Cookie(AuthCookieService.PM_ACCESS_COOKIE_NAME, "pm-token"));

        assertThat(service.readAccessToken(request)).contains("pm-token");
    }

    @Test
    void writeAuthCookiesRejectsMissingScope() {
        AuthCookieService service = createService();
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
        MockHttpServletResponse response = new MockHttpServletResponse();

        assertThatThrownBy(() -> service.writeAuthCookies(request, response, "access-token", "refresh-token"))
                .isInstanceOf(AppException.class)
                .extracting("code")
                .isEqualTo("APP_SCOPE_REQUIRED");
    }

    @Test
    void clearAuthCookiesRejectsMissingScope() {
        AuthCookieService service = createService();
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/logout");
        MockHttpServletResponse response = new MockHttpServletResponse();

        assertThatThrownBy(() -> service.clearAuthCookies(request, response))
                .isInstanceOf(AppException.class)
                .extracting("code")
                .isEqualTo("APP_SCOPE_REQUIRED");
    }

    @Test
    void readRefreshTokenRejectsMissingScope() {
        AuthCookieService service = createService();
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/refresh");

        assertThatThrownBy(() -> service.readRefreshToken(request))
                .isInstanceOf(AppException.class)
                .extracting("code")
                .isEqualTo("APP_SCOPE_REQUIRED");
    }

    @Test
    void writeAuthCookiesUsesScopedCookieNames() {
        AuthCookieService service = createService();
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
        request.addHeader(AuthCookieService.APP_HEADER_NAME, "admin");
        MockHttpServletResponse response = new MockHttpServletResponse();

        service.writeAuthCookies(request, response, "access-token", "refresh-token");

        assertThat(response.getHeaders("Set-Cookie")).anySatisfy(cookie -> assertThat(cookie).contains(AuthCookieService.ADMIN_ACCESS_COOKIE_NAME + "="));
        assertThat(response.getHeaders("Set-Cookie")).anySatisfy(cookie -> assertThat(cookie).contains(AuthCookieService.ADMIN_REFRESH_COOKIE_NAME + "="));
    }

    private AuthCookieService createService() {
        JwtProperties jwtProperties = new JwtProperties();
        jwtProperties.setAccessExpirationMinutes(15);
        jwtProperties.setRefreshExpirationDays(30);

        SecurityProperties securityProperties = new SecurityProperties();
        return new AuthCookieService(jwtProperties, securityProperties);
    }
}
