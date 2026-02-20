package com.bridge.backend.config;

import com.bridge.backend.common.security.AuthCookieService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class HealthEndpointSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void healthIsAccessibleWithoutAppScopeHeader() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    void healthIsAccessibleWithAppScopeHeader() throws Exception {
        mockMvc.perform(get("/actuator/health")
                        .header(AuthCookieService.APP_HEADER_NAME, "pm"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    void livenessStillRequiresAppScopeHeader() throws Exception {
        mockMvc.perform(get("/actuator/health/liveness"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("APP_SCOPE_REQUIRED"));
    }

    @Test
    void readinessStillRequiresAppScopeHeader() throws Exception {
        mockMvc.perform(get("/actuator/health/readiness"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("APP_SCOPE_REQUIRED"));
    }

    @Test
    void apiRequestWithoutScopeHeaderStillFails() throws Exception {
        mockMvc.perform(get("/api/projects"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("APP_SCOPE_REQUIRED"));
    }
}
