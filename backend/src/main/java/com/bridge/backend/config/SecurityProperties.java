package com.bridge.backend.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

@Getter
@Setter
@ConfigurationProperties(prefix = "bridge.security")
public class SecurityProperties {
    private List<String> allowedOrigins;
    private String authCookieDomain;
}
