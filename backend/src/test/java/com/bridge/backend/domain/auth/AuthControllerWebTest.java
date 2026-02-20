package com.bridge.backend.domain.auth;

import com.bridge.backend.common.api.GlobalExceptionHandler;
import com.bridge.backend.common.security.AuthCookieService;
import com.bridge.backend.common.security.JwtAuthenticationFilter;
import com.bridge.backend.common.security.JwtProperties;
import com.bridge.backend.common.security.JwtService;
import com.bridge.backend.config.SecurityConfig;
import com.bridge.backend.config.SecurityProperties;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = AuthController.class)
@AutoConfigureMockMvc
@Import({
        SecurityConfig.class,
        GlobalExceptionHandler.class,
        AuthCookieService.class,
        JwtAuthenticationFilter.class,
        AuthControllerWebTest.TestBeans.class
})
class AuthControllerWebTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AuthService authService;

    @MockitoBean
    private JwtService jwtService;

    @Test
    void logoutReturnsOkAndClearsScopedCookiesWithoutAuthentication() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/logout")
                        .header(AuthCookieService.APP_HEADER_NAME, "pm")
                        .cookie(new Cookie(AuthCookieService.PM_REFRESH_COOKIE_NAME, "refresh-token")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.loggedOut").value(true))
                .andReturn();

        List<String> cookies = result.getResponse().getHeaders("Set-Cookie");
        assertThat(cookies).hasSize(2);
        assertThat(cookies).anySatisfy(value -> assertThat(value)
                .contains(AuthCookieService.PM_ACCESS_COOKIE_NAME + "=")
                .contains("Max-Age=0"));
        assertThat(cookies).anySatisfy(value -> assertThat(value)
                .contains(AuthCookieService.PM_REFRESH_COOKIE_NAME + "=")
                .contains("Max-Age=0"));
        verify(authService).logout("refresh-token");
    }

    @Test
    void logoutRejectsMissingAppScope() throws Exception {
        mockMvc.perform(post("/api/auth/logout"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("APP_SCOPE_REQUIRED"));
    }

    @TestConfiguration
    static class TestBeans {
        @Bean
        JwtProperties jwtProperties() {
            JwtProperties properties = new JwtProperties();
            properties.setAccessExpirationMinutes(15);
            properties.setRefreshExpirationDays(30);
            properties.setSecret("test-secret-test-secret-test-secret-test-secret");
            properties.setIssuer("test");
            return properties;
        }

        @Bean
        SecurityProperties securityProperties() {
            SecurityProperties properties = new SecurityProperties();
            properties.setAllowedOrigins(List.of("http://localhost:3000"));
            return properties;
        }
    }
}
