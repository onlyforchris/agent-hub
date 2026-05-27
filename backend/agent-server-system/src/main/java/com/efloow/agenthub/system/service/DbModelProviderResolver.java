package com.efloow.agenthub.system.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.efloow.agenthub.common.llm.ModelProviderResolver;
import com.efloow.agenthub.common.util.AesUtil;
import com.efloow.agenthub.system.entity.SystemModelProvider;
import com.efloow.agenthub.system.mapper.SystemModelProviderMapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.List;

@Component
public class DbModelProviderResolver implements ModelProviderResolver {

    private static final Logger log = LoggerFactory.getLogger(DbModelProviderResolver.class);

    private final SystemModelProviderMapper mapper;
    private final String encryptionSecret;
    private final ObjectMapper objectMapper;

    public DbModelProviderResolver(
            SystemModelProviderMapper mapper,
            ObjectMapper objectMapper,
            @Value("${agent.llm.encryption-secret:efloow-model-key-2026}") String encryptionSecret
    ) {
        this.mapper = mapper;
        this.objectMapper = objectMapper;
        this.encryptionSecret = encryptionSecret;
    }

    @Override
    public ModelProviderConfig resolve(String providerCode) {
        if (providerCode == null || providerCode.isBlank()) {
            return null;
        }

        SystemModelProvider entity = mapper.selectOne(
            new LambdaQueryWrapper<SystemModelProvider>()
                .eq(SystemModelProvider::getProviderCode, providerCode)
                .ne(SystemModelProvider::getStatus, 2)
        );

        if (entity == null) {
            log.debug("provider not found in DB: code={}", providerCode);
            return null;
        }

        String plainApiKey = decryptApiKey(entity.getApiKey());
        List<String> models = parseModels(entity.getModels());

        log.info("resolved provider from DB: code={}, baseUrl={}, models={}, enabled={}",
            providerCode, entity.getBaseUrl(), models, entity.getIsEnabled());

        return new ModelProviderConfig(
            entity.getProviderCode(),
            entity.getProviderName(),
            entity.getBaseUrl(),
            plainApiKey,
            models,
            entity.getDefaultModel(),
            entity.getIsEnabled() != null && entity.getIsEnabled() == 1
        );
    }

    private String decryptApiKey(String encryptedApiKey) {
        if (encryptedApiKey == null || encryptedApiKey.isBlank()) {
            return "";
        }
        try {
            return AesUtil.decrypt(encryptedApiKey, encryptionSecret);
        } catch (Exception e) {
            log.error("API Key 解密失败", e);
            return "";
        }
    }

    private List<String> parseModels(String modelsJson) {
        if (modelsJson == null || modelsJson.isBlank()) {
            return Collections.emptyList();
        }
        try {
            return objectMapper.readValue(modelsJson, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            log.warn("models JSON parse failed: {}", modelsJson, e);
            return Collections.emptyList();
        }
    }
}
