package com.bridge.backend.common.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
public class JwtService {
    private final JwtProperties properties;
    private SecretKey key;

    public JwtService(JwtProperties properties) {
        this.properties = properties;
    }

    @PostConstruct
    void init() {
        this.key = Keys.hmacShaKeyFor(properties.getSecret().getBytes(StandardCharsets.UTF_8));
    }

    public String issueAccessToken(UUID userId, UUID tenantId, Set<String> roles) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(userId.toString())
                .issuer(properties.getIssuer())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(properties.getAccessExpirationMinutes(), ChronoUnit.MINUTES)))
                .claim("tenantId", tenantId.toString())
                .claim("roles", roles)
                .claim("type", "access")
                .signWith(key)
                .compact();
    }

    public String issueRefreshToken(UUID userId, UUID tenantId) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(userId.toString())
                .issuer(properties.getIssuer())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(properties.getRefreshExpirationDays(), ChronoUnit.DAYS)))
                .claim("tenantId", tenantId.toString())
                .claim("type", "refresh")
                .signWith(key)
                .compact();
    }

    public Claims parse(String token) {
        return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
    }

    public boolean isRefreshToken(Claims claims) {
        return "refresh".equals(claims.get("type", String.class));
    }

    @SuppressWarnings("unchecked")
    public Set<String> extractRoles(Claims claims) {
        Object roles = claims.get("roles");
        if (roles == null) {
            return Collections.emptySet();
        }
        if (roles instanceof List<?> list) {
            Set<String> mapped = new HashSet<>();
            list.forEach(item -> mapped.add(String.valueOf(item)));
            return mapped;
        }
        return Collections.singleton(String.valueOf(roles));
    }
}
