package com.efloow.agenthub.system.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.efloow.agenthub.common.exception.BusinessException;
import com.efloow.agenthub.system.entity.AgentNotification;
import com.efloow.agenthub.system.entity.AgentNotificationReceipt;
import com.efloow.agenthub.system.entity.AgentNotificationTemplate;
import com.efloow.agenthub.system.entity.SystemUser;
import com.efloow.agenthub.system.mapper.AgentNotificationMapper;
import com.efloow.agenthub.system.mapper.AgentNotificationReceiptMapper;
import com.efloow.agenthub.system.mapper.AgentNotificationTemplateMapper;
import com.efloow.agenthub.system.mapper.RbacMapper;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);
    private static final Pattern VAR_PATTERN = Pattern.compile("\\{\\{(\\w+)}}");

    private final AgentNotificationMapper notificationMapper;
    private final AgentNotificationReceiptMapper receiptMapper;
    private final AgentNotificationTemplateMapper templateMapper;
    private final RbacMapper rbacMapper;

    public NotificationService(
            AgentNotificationMapper notificationMapper,
            AgentNotificationReceiptMapper receiptMapper,
            AgentNotificationTemplateMapper templateMapper,
            RbacMapper rbacMapper
    ) {
        this.notificationMapper = notificationMapper;
        this.receiptMapper = receiptMapper;
        this.templateMapper = templateMapper;
        this.rbacMapper = rbacMapper;
    }

    // ── 系统级发送（无需登录上下文，供定时任务等系统调用）──

    public AgentNotification sendSystem(String title, String content, String category,
                                         String channel, String recipientId) {
        if (isInAppChannel(channel) && !inAppChannelEnabled()) {
            log.warn("sendSystem skipped: IN_APP channel disabled, category={}, recipient={}", category, recipientId);
            return null;
        }
        if (title == null || title.isBlank()) {
            log.warn("sendSystem skipped: blank title, category={}, recipient={}", category, recipientId);
            return null;
        }
        if (recipientId == null || recipientId.isBlank()) {
            log.warn("sendSystem skipped: blank recipientId, category={}", category);
            return null;
        }

        String notifId = UUID.randomUUID().toString();
        AgentNotification notification = new AgentNotification();
        notification.setId(notifId);
        notification.setTitle(title);
        notification.setContent(content);
        notification.setCategory(category != null ? category : "TODO");
        notification.setSenderId("system");
        notification.setTargetType("USER");
        notification.setTargetId(recipientId);
        notification.setChannel(channel != null ? channel : "IN_APP");
        notification.setPriority(0);
        notification.setStatus(1);
        notification.setCreateBy("system");
        notificationMapper.insert(notification);

        AgentNotificationReceipt receipt = new AgentNotificationReceipt();
        receipt.setId(UUID.randomUUID().toString());
        receipt.setNotificationId(notifId);
        receipt.setRecipientId(recipientId);
        receipt.setIsRead(0);
        receipt.setIsDeleted(0);
        receipt.setStatus(1);
        receipt.setCreateBy("system");
        receiptMapper.insert(receipt);

        log.info("系统通知已发送: notifId={}, title={}, category={}, recipient={}",
            notifId, title, category, recipientId);
        return notification;
    }

    @Transactional
    public AgentNotification send(String title, String content, String category,
                                   String targetType, String targetId, String senderId) {
        if (!inAppChannelEnabled()) {
            log.warn("通知发送已跳过: IN_APP channel disabled, category={}, targetType={}, targetId={}",
                    category, targetType, targetId);
            return null;
        }
        if (title == null || title.isBlank()) {
            throw new BusinessException("N001_TITLE_REQUIRED", "通知标题不能为空");
        }
        List<String> recipientIds = resolveRecipients(targetType, targetId);
        if (recipientIds.isEmpty()) {
            log.warn("通知发送目标为空: targetType={}, targetId={}", targetType, targetId);
            return null;
        }

        AgentNotification notification = new AgentNotification();
        notification.setId(UUID.randomUUID().toString());
        notification.setTitle(title);
        notification.setContent(content);
        notification.setCategory(category != null ? category : "SYSTEM");
        notification.setSenderId(senderId != null ? senderId : "system");
        notification.setTargetType(targetType != null ? targetType : "USER");
        notification.setTargetId(targetId);
        notification.setChannel("IN_APP");
        notification.setPriority(0);
        notification.setStatus(1);
        notification.setCreateBy(senderId);
        notificationMapper.insert(notification);

        for (String recipientId : recipientIds) {
            AgentNotificationReceipt receipt = new AgentNotificationReceipt();
            receipt.setId(UUID.randomUUID().toString());
            receipt.setNotificationId(notification.getId());
            receipt.setRecipientId(recipientId);
            receipt.setIsRead(0);
            receipt.setIsDeleted(0);
            receipt.setStatus(1);
            receipt.setCreateBy(senderId);
            receiptMapper.insert(receipt);
        }

        log.info("通知已发送: id={}, category={}, recipients={}",
                notification.getId(), category, recipientIds.size());
        return notification;
    }

    @Transactional
    public AgentNotification sendByTemplate(String templateCode, Map<String, String> variables,
                                             String targetType, String targetId, String senderId) {
        AgentNotificationTemplate template = templateMapper.selectOne(
                new LambdaQueryWrapper<AgentNotificationTemplate>()
                        .eq(AgentNotificationTemplate::getTemplateCode, templateCode)
                        .eq(AgentNotificationTemplate::getStatus, 1)
        );
        if (template == null) {
            throw new BusinessException("N002_TEMPLATE_NOT_FOUND", "消息模板不存在: " + templateCode);
        }

        String title = renderTemplate(template.getTitleTemplate(), variables);
        String content = renderTemplate(template.getContentTemplate(), variables);

        AgentNotification notification = send(title, content, resolveCategory(templateCode),
                targetType, targetId, senderId);
        if (notification != null) {
            notification.setTemplateId(template.getId());
            notificationMapper.updateById(notification);
        }
        return notification;
    }

    // ── 查询通知列表 ──────────────────────────────────────────

    public Page<Map<String, Object>> listMyNotifications(int pageNum, int pageSize) {
        String userId = currentUserId();
        Page<Map<String, Object>> page = new Page<>(pageNum, pageSize);
        return receiptMapper.selectMyNotifications(page, userId);
    }

    public long unreadCount() {
        String userId = currentUserId();
        Long count = receiptMapper.selectCount(
                new LambdaQueryWrapper<AgentNotificationReceipt>()
                        .eq(AgentNotificationReceipt::getRecipientId, userId)
                        .eq(AgentNotificationReceipt::getIsRead, 0)
                        .eq(AgentNotificationReceipt::getIsDeleted, 0)
                        .eq(AgentNotificationReceipt::getStatus, 1)
        );
        return count != null ? count : 0;
    }

    // ── 标记已读 ──────────────────────────────────────────────

    @Transactional
    public void markRead(String receiptId) {
        AgentNotificationReceipt receipt = receiptMapper.selectById(receiptId);
        if (receipt == null) {
            throw new BusinessException("N003_RECEIPT_NOT_FOUND", "通知记录不存在");
        }
        if (!receipt.getRecipientId().equals(currentUserId())) {
            throw new AccessDeniedException("无权操作该通知");
        }
        receipt.setIsRead(1);
        receipt.setReadAt(LocalDateTime.now());
        receiptMapper.updateById(receipt);
    }

    @Transactional
    public void markAllRead() {
        String userId = currentUserId();
        int count = receiptMapper.markAllRead(userId);
        log.info("全部标记已读: userId={}, count={}", userId, count);
    }

    // ── 删除通知 ──────────────────────────────────────────────

    @Transactional
    public void delete(String receiptId) {
        AgentNotificationReceipt receipt = receiptMapper.selectById(receiptId);
        if (receipt == null) {
            throw new BusinessException("N003_RECEIPT_NOT_FOUND", "通知记录不存在");
        }
        if (!receipt.getRecipientId().equals(currentUserId())) {
            throw new AccessDeniedException("无权操作该通知");
        }
        receipt.setIsDeleted(1);
        receipt.setUpdateBy(currentUserId());
        receiptMapper.updateById(receipt);
    }

    // ── 模板管理 ──────────────────────────────────────────────

    public List<AgentNotificationTemplate> listTemplates() {
        return templateMapper.selectList(
                new LambdaQueryWrapper<AgentNotificationTemplate>()
                        .ne(AgentNotificationTemplate::getStatus, 2)
                        .orderByAsc(AgentNotificationTemplate::getCreateTime)
        );
    }

    @Transactional
    public AgentNotificationTemplate createTemplate(AgentNotificationTemplate template) {
        template.setId(UUID.randomUUID().toString());
        template.setStatus(template.getStatus() != null ? template.getStatus() : 1);
        template.setCreateBy(currentUserId());
        templateMapper.insert(template);
        log.info("模板已创建: code={}, id={}", template.getTemplateCode(), template.getId());
        return template;
    }

    @Transactional
    public AgentNotificationTemplate updateTemplate(AgentNotificationTemplate update) {
        AgentNotificationTemplate existing = templateMapper.selectById(update.getId());
        if (existing == null) {
            throw new BusinessException("N002_TEMPLATE_NOT_FOUND", "模板不存在: " + update.getId());
        }
        existing.setTemplateCode(update.getTemplateCode());
        existing.setTitleTemplate(update.getTitleTemplate());
        existing.setContentTemplate(update.getContentTemplate());
        existing.setVariables(update.getVariables());
        existing.setChannel(update.getChannel());
        existing.setStatus(update.getStatus() != null ? update.getStatus() : existing.getStatus());
        existing.setRemark(update.getRemark());
        existing.setUpdateBy(currentUserId());
        templateMapper.updateById(existing);
        return existing;
    }

    @Transactional
    public void deleteTemplate(String id) {
        AgentNotificationTemplate template = templateMapper.selectById(id);
        if (template == null) {
            throw new BusinessException("N002_TEMPLATE_NOT_FOUND", "模板不存在: " + id);
        }
        template.setStatus(2);
        template.setUpdateBy(currentUserId());
        templateMapper.updateById(template);
    }

    // ── 渠道统计 ──────────────────────────────────────────────

    public Map<String, Object> getStats() {
        Long totalNotifications = notificationMapper.selectCount(
                new LambdaQueryWrapper<AgentNotification>()
                        .eq(AgentNotification::getStatus, 1)
        );
        Long todaySent = notificationMapper.selectCount(
                new LambdaQueryWrapper<AgentNotification>()
                        .eq(AgentNotification::getStatus, 1)
                        .ge(AgentNotification::getCreateTime, LocalDateTime.now().withHour(0).withMinute(0).withSecond(0))
        );
        Long templateCount = templateMapper.selectCount(
                new LambdaQueryWrapper<AgentNotificationTemplate>()
                        .eq(AgentNotificationTemplate::getStatus, 1)
        );
        return Map.of(
                "totalNotifications", totalNotifications != null ? totalNotifications : 0,
                "todaySent", todaySent != null ? todaySent : 0,
                "templateCount", templateCount != null ? templateCount : 0
        );
    }

    // ── 目标范围解析 ──────────────────────────────────────────

    private List<String> resolveRecipients(String targetType, String targetId) {
        if (targetType == null) {
            return Collections.emptyList();
        }
        return switch (targetType) {
            case "USER" -> {
                if (targetId == null || targetId.isBlank()) {
                    yield List.of(currentUserId());
                }
                yield List.of(targetId);
            }
            case "ROLE" -> {
                if (targetId == null || targetId.isBlank()) {
                    yield Collections.emptyList();
                }
                yield rbacMapper.selectUserIdsByRoleId(targetId);
            }
            case "DEPARTMENT" -> {
                if (targetId == null || targetId.isBlank()) {
                    yield Collections.emptyList();
                }
                yield rbacMapper.selectUserIdsByDepartmentId(targetId);
            }
            case "ORG" -> rbacMapper.selectAllActiveUserIds();
            default -> {
                log.warn("未知通知目标类型: {}", targetType);
                yield Collections.emptyList();
            }
        };
    }

    private String resolveCategory(String templateCode) {
        if (templateCode == null) {
            return "SYSTEM";
        }
        if (templateCode.startsWith("todo.")) {
            return "TODO";
        }
        if (templateCode.startsWith("agent.")) {
            return "AGENT";
        }
        return "SYSTEM";
    }

    String renderTemplate(String template, Map<String, String> variables) {
        if (template == null) {
            return "";
        }
        Matcher matcher = VAR_PATTERN.matcher(template);
        StringBuilder result = new StringBuilder();
        while (matcher.find()) {
            String key = matcher.group(1);
            String value = variables != null ? variables.getOrDefault(key, "") : "";
            matcher.appendReplacement(result, Matcher.quoteReplacement(value != null ? value : ""));
        }
        matcher.appendTail(result);
        return result.toString();
    }

    private boolean inAppChannelEnabled() {
        Long count = templateMapper.selectCount(
                new LambdaQueryWrapper<AgentNotificationTemplate>()
                        .eq(AgentNotificationTemplate::getChannel, "IN_APP")
                        .eq(AgentNotificationTemplate::getStatus, 1)
        );
        return count != null && count > 0;
    }

    private boolean isInAppChannel(String channel) {
        return channel == null || channel.isBlank() || "IN_APP".equalsIgnoreCase(channel);
    }

    private String currentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof SystemUser user)) {
            throw new AccessDeniedException("请先登录");
        }
        return user.getId();
    }
}
