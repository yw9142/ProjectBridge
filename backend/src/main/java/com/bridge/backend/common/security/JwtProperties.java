package com.bridge.backend.common.security;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "bridge.jwt")
public class JwtProperties {
    private String issuer;
    private String secret;
    private long accessExpirationMinutes;
    private long refreshExpirationDays;
}
