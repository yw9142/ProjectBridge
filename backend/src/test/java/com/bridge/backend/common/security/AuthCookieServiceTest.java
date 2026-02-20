package com.bridge.backend.common.security;

import com.bridge.backend.config.SecurityProperties;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;

class AuthCookieServiceTest {

    @Test
    void readAccessTokenIgnoresLegacyCookieWithoutScope() {
        AuthCookieService service = createService();
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new Cookie("bridge_access_token", "legacy-token"));

        assertThat(service.readAccessToken(request)).isEmpty();
    }

    @Test
    void readAccessTokenUsesScopedCookie() {
        AuthCookieService service = createService();
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(AuthCookieService.APP_HEADER_NAME, "pm");
        request.setCookies(new Cookie(AuthCookieService.PM_ACCESS_COOKIE_NAME, "pm-token"));

        assertThat(service.readAccessToken(request)).contains("pm-token");
    }

    @Test
    void readAccessTokenReturnsEmptyWhenScopedCookieMissing() {
        AuthCookieService service = createService();
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(AuthCookieService.APP_HEADER_NAME, "pm");
        request.setCookies(new Cookie("bridge_access_token", "legacy-token"));

        assertThat(service.readAccessToken(request)).isEmpty();
    }

    @Test
    void writeAuthCookiesRequiresScope() {
        AuthCookieService service = createService();
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        service.writeAuthCookies(request, response, "access-token", "refresh-token");

        assertThat(response.getHeaders("Set-Cookie")).isEmpty();
    }

    @Test
    void writeAuthCookiesUsesScopedCookieNames() {
        AuthCookieService service = createService();
        MockHttpServletRequest request = new MockHttpServletRequest();
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
