package com.bridge.backend.domain.integration;

import com.bridge.backend.common.api.ApiSuccess;
import com.bridge.backend.common.security.SecurityUtils;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/integrations/google")
public class GoogleIntegrationController {

    @GetMapping("/status")
    public ApiSuccess<Map<String, Object>> status() {
        SecurityUtils.requirePrincipal();
        return ApiSuccess.of(Map.of("enabled", false, "connected", false, "code", "FEATURE_DISABLED"));
    }

    @PostMapping("/connect")
    public ApiSuccess<Map<String, Object>> connect() {
        SecurityUtils.requirePrincipal();
        return ApiSuccess.of(Map.of("enabled", false, "code", "FEATURE_DISABLED"));
    }

    @GetMapping("/callback")
    public ApiSuccess<Map<String, Object>> callback() {
        return ApiSuccess.of(Map.of("enabled", false, "code", "FEATURE_DISABLED"));
    }

    @PostMapping("/disconnect")
    public ApiSuccess<Map<String, Object>> disconnect() {
        SecurityUtils.requirePrincipal();
        return ApiSuccess.of(Map.of("enabled", false, "code", "FEATURE_DISABLED"));
    }
}
