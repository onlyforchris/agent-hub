package com.efloow.agenthub.system.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.efloow.agenthub.common.exception.BusinessException;
import com.efloow.agenthub.common.util.AesUtil;
import com.efloow.agenthub.system.entity.SystemModelProvider;
import com.efloow.agenthub.system.entity.SystemUser;
import com.efloow.agenthub.system.mapper.SystemModelProviderMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import com.efloow.agenthub.system.dto.ModelTestResultDto;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class ModelProviderService {

    private static final Logger log = LoggerFactory.getLogger(ModelProviderService.class);

    private final SystemModelProviderMapper mapper;
    private final RbacService rbacService;
    private final String encryptionSecret;

    public ModelProviderService(
            SystemModelProviderMapper mapper,
            RbacService rbacService,
            @Value("${agent.llm.encryption-secret:efloow-model-key-2026}") String encryptionSecret
    ) {
        this.mapper = mapper;
        this.rbacService = rbacService;
        this.encryptionSecret = encryptionSecret;
    }

    public List<SystemModelProvider> listProviders() {
        rbacService.assertPermission("system:model-provider:view");
        List<SystemModelProvider> list = mapper.selectList(
                new LambdaQueryWrapper<SystemModelProvider>()
                        .ne(SystemModelProvider::getStatus, 2)
                        .orderByAsc(SystemModelProvider::getSortOrder)
        );
        for (SystemModelProvider p : list) {
            p.setApiKey(maskApiKey(p.getApiKey()));
        }
        return list;
    }

    @Transactional
    public String createProvider(SystemModelProvider provider) {
        rbacService.assertPermission("system:model-provider:add");
        requireAny(provider.getProviderCode(), provider.getProviderName());
        String id = UUID.randomUUID().toString();
        provider.setId(id);
        provider.setCreateBy(currentUserId());
        provider.setStatus(provider.getStatus() != null ? provider.getStatus() : 1);
        provider.setIsEnabled(provider.getIsEnabled() != null ? provider.getIsEnabled() : 1);
        provider.setSortOrder(provider.getSortOrder() != null ? provider.getSortOrder() : 0);
        if (provider.getApiKey() != null && !provider.getApiKey().isBlank()) {
            provider.setApiKey(AesUtil.encrypt(provider.getApiKey(), encryptionSecret));
        }
        mapper.insert(provider);
        log.info("模型供应商已创建: code={}, name={}", provider.getProviderCode(), provider.getProviderName());
        return id;
    }

    @Transactional
    public void updateProvider(String id, SystemModelProvider provider) {
        rbacService.assertPermission("system:model-provider:edit");
        SystemModelProvider existing = mapper.selectById(id);
        if (existing == null || (existing.getStatus() != null && existing.getStatus() == 2)) {
            throw new BusinessException("D001_NOT_FOUND", "模型供应商不存在");
        }
        if (provider.getProviderName() != null && !provider.getProviderName().isBlank()) {
            existing.setProviderName(provider.getProviderName());
        }
        if (provider.getBaseUrl() != null) {
            existing.setBaseUrl(provider.getBaseUrl());
        }
        if (provider.getModels() != null) {
            existing.setModels(provider.getModels());
        }
        if (provider.getDefaultModel() != null) {
            existing.setDefaultModel(provider.getDefaultModel());
        }
        if (provider.getIsEnabled() != null) {
            existing.setIsEnabled(provider.getIsEnabled());
        }
        if (provider.getSortOrder() != null) {
            existing.setSortOrder(provider.getSortOrder());
        }
        if (provider.getRemark() != null) {
            existing.setRemark(provider.getRemark());
        }
        if (provider.getApiKey() != null && !provider.getApiKey().isBlank()) {
            existing.setApiKey(AesUtil.encrypt(provider.getApiKey(), encryptionSecret));
        }
        existing.setUpdateBy(currentUserId());
        mapper.updateById(existing);
        log.info("模型供应商已更新: id={}", id);
    }

    @Transactional
    public void deleteProvider(String id) {
        rbacService.assertPermission("system:model-provider:delete");
        SystemModelProvider entity = new SystemModelProvider();
        entity.setId(id);
        entity.setStatus(2);
        entity.setUpdateBy(currentUserId());
        mapper.updateById(entity);
        log.info("模型供应商已删除: id={}", id);
    }

    public ModelTestResultDto testConnection(String id) {
        rbacService.assertPermission("system:model-provider:test");
        SystemModelProvider entity = mapper.selectById(id);
        if (entity == null || entity.getStatus() != null && entity.getStatus() == 2) {
            throw new BusinessException("D001_NOT_FOUND", "模型供应商不存在");
        }
        String apiKey = decryptApiKey(entity.getApiKey());
        if (apiKey.isBlank()) {
            String envKey = System.getenv("DEEPSEEK_API_KEY");
            if (envKey != null && !envKey.isBlank()) {
                apiKey = envKey;
            }
        }
        if (apiKey.isBlank()) {
            return new ModelTestResultDto(false, 0, "未配置 API Key", entity.getDefaultModel());
        }
        String baseUrl = entity.getBaseUrl() != null ? entity.getBaseUrl().trim() : "";
        if (baseUrl.isBlank()) {
            return new ModelTestResultDto(false, 0, "未配置 Base URL", entity.getDefaultModel());
        }
        String model = entity.getDefaultModel() != null && !entity.getDefaultModel().isBlank()
                ? entity.getDefaultModel() : "deepseek-v4-flash";
        long start = System.currentTimeMillis();
        try {
            RestClient client = RestClient.builder()
                    .baseUrl(baseUrl)
                    .defaultHeader("Authorization", "Bearer " + apiKey)
                    .defaultHeader("Content-Type", MediaType.APPLICATION_JSON_VALUE)
                    .build();
            Map<String, Object> body = Map.of(
                    "model", model,
                    "messages", List.of(Map.of("role", "user", "content", "ping")),
                    "max_tokens", 8
            );
            client.post()
                    .uri("/v1/chat/completions")
                    .body(body)
                    .retrieve()
                    .body(String.class);
            int latency = (int) (System.currentTimeMillis() - start);
            log.info("模型连接测试成功: id={}, provider={}, latencyMs={}", id, entity.getProviderCode(), latency);
            return new ModelTestResultDto(true, latency, "连接成功", model);
        } catch (Exception e) {
            int latency = (int) (System.currentTimeMillis() - start);
            log.warn("模型连接测试失败: id={}, err={}", id, e.getMessage());
            return new ModelTestResultDto(false, latency, "连接失败: " + e.getMessage(), model);
        }
    }

    public String decryptApiKey(String encryptedApiKey) {
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

    private String maskApiKey(String encryptedApiKey) {
        if (encryptedApiKey == null || encryptedApiKey.isEmpty()) {
            return "";
        }
        try {
            String decrypted = AesUtil.decrypt(encryptedApiKey, encryptionSecret);
            if (decrypted.length() <= 8) {
                return "****";
            }
            return decrypted.substring(0, 4) + "****" + decrypted.substring(decrypted.length() - 4);
        } catch (Exception e) {
            return "****";
        }
    }

    private String currentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof SystemUser user)) {
            throw new AccessDeniedException("请先登录");
        }
        return user.getId();
    }

    private void requireAny(String... values) {
        for (String v : values) {
            if (v == null || v.isBlank()) {
                throw new BusinessException("C001_EMPTY_BODY", "缺少必填字段");
            }
        }
    }
}
