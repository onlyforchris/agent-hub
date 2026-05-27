package com.efloow.agenthub.system.service;

import com.efloow.agenthub.system.mapper.RbacMapper;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class RbacServiceTest {

    @Test
    void resolvesExactResourceBeforeAntPattern() {
        RbacMapper mapper = mock(RbacMapper.class);
        PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
        @SuppressWarnings("unchecked")
        ObjectProvider<StringRedisTemplate> redisProvider = mock(ObjectProvider.class);
        RbacService service = new RbacService(mapper, passwordEncoder, redisProvider);

        when(mapper.selectPermissionByMethodAndPath("GET", "/api/rbac/users/1")).thenReturn("system:user:exact");

        assertThat(service.permissionByMethodAndPath("GET", "/api/rbac/users/1"))
                .isEqualTo("system:user:exact");
    }

    @Test
    void resolvesAntResourceWhenExactResourceMissing() {
        RbacMapper mapper = mock(RbacMapper.class);
        PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
        @SuppressWarnings("unchecked")
        ObjectProvider<StringRedisTemplate> redisProvider = mock(ObjectProvider.class);
        RbacService service = new RbacService(mapper, passwordEncoder, redisProvider);

        when(mapper.selectAntResourcesByMethod("GET")).thenReturn(List.of(
                Map.of("path", "/api/rbac/users/{id}", "resourceCode", "system:user:view")
        ));

        assertThat(service.permissionByMethodAndPath("GET", "/api/rbac/users/1"))
                .isEqualTo("system:user:view");
    }
}
