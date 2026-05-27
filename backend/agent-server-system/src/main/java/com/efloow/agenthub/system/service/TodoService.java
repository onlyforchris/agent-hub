package com.efloow.agenthub.system.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.efloow.agenthub.common.exception.BusinessException;
import com.efloow.agenthub.system.entity.AgentTodo;
import com.efloow.agenthub.system.entity.AgentTodoAcl;
import com.efloow.agenthub.system.entity.AgentTodoReminder;
import com.efloow.agenthub.system.entity.SystemUser;
import com.efloow.agenthub.system.mapper.AgentTodoAclMapper;
import com.efloow.agenthub.system.mapper.AgentTodoMapper;
import com.efloow.agenthub.system.mapper.AgentTodoReminderMapper;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TodoService {

    private static final Logger log = LoggerFactory.getLogger(TodoService.class);

    private final AgentTodoMapper todoMapper;
    private final AgentTodoAclMapper aclMapper;
    private final AgentTodoReminderMapper reminderMapper;
    private final TodoReminderScheduler reminderScheduler;

    public TodoService(
            AgentTodoMapper todoMapper,
            AgentTodoAclMapper aclMapper,
            AgentTodoReminderMapper reminderMapper,
            TodoReminderScheduler reminderScheduler
    ) {
        this.todoMapper = todoMapper;
        this.aclMapper = aclMapper;
        this.reminderMapper = reminderMapper;
        this.reminderScheduler = reminderScheduler;
    }

    // ── 创建待办 ──────────────────────────────────────────────

    @Transactional
    public AgentTodo create(String title, String description, String assigneeUserId,
                             LocalDateTime dueDate, LocalDateTime remindAt,
                             String visibility, List<Map<String, String>> aclEntries) {
        if (title == null || title.isBlank()) {
            throw new BusinessException("TODO001_TITLE_REQUIRED", "待办标题不能为空");
        }
        if (remindAt != null && dueDate != null && !remindAt.isBefore(dueDate)) {
            throw new BusinessException("TODO003_INVALID_REMIND_TIME", "提醒时间必须早于截止日期");
        }

        String userId = currentUserId();
        AgentTodo todo = new AgentTodo();
        todo.setId(UUID.randomUUID().toString());
        todo.setTitle(title);
        todo.setDescription(description);
        todo.setAssigneeUserId(assigneeUserId != null ? assigneeUserId : userId);
        todo.setCreatedBy(userId);
        todo.setStatus(0);
        todo.setPriority(0);
        todo.setDueDate(dueDate);
        todo.setRemindAt(remindAt);
        todo.setVisibility(visibility != null ? visibility : "private");
        todoMapper.insert(todo);

        // 写入 ACL 记录
        if (aclEntries != null) {
            for (Map<String, String> entry : aclEntries) {
                AgentTodoAcl acl = new AgentTodoAcl();
                acl.setId(UUID.randomUUID().toString());
                acl.setTodoId(todo.getId());
                acl.setSubjectType(entry.get("subjectType"));
                acl.setSubjectId(entry.get("subjectId"));
                acl.setPermission(entry.getOrDefault("permission", "READ"));
                acl.setStatus(1);
                acl.setCreateBy(userId);
                aclMapper.insert(acl);
            }
        }

        // 写入提醒记录 + 调度精准推送
        if (remindAt != null) {
            AgentTodoReminder reminder = new AgentTodoReminder();
            reminder.setId(UUID.randomUUID().toString());
            reminder.setTodoId(todo.getId());
            reminder.setChannel("IN_APP");
            reminder.setScheduledAt(remindAt);
            reminder.setStatus(0);
            reminder.setRetryCount(0);
            reminder.setCreateBy(userId);
            reminderMapper.insert(reminder);
            reminderScheduler.scheduleReminder(reminder);
        }

        log.info("待办已创建: id={}, title={}, assignee={}", todo.getId(), title, todo.getAssigneeUserId());
        return todo;
    }

    // ── 查询待办列表 ──────────────────────────────────────────

    public List<AgentTodo> listMine(String assigneeFilter, Integer statusFilter) {
        String userId = currentUserId();
        List<AgentTodo> all = todoMapper.selectList(
                new LambdaQueryWrapper<AgentTodo>()
                        .ne(AgentTodo::getStatus, 99)
                        .orderByDesc(AgentTodo::getCreateTime)
        );

        List<AgentTodo> visible = new ArrayList<>();
        for (AgentTodo todo : all) {
            if (canRead(todo, userId)) {
                if (assigneeFilter != null && !assigneeFilter.isBlank()
                        && !assigneeFilter.equals(todo.getAssigneeUserId())) {
                    continue;
                }
                if (statusFilter != null && !statusFilter.equals(todo.getStatus())) {
                    continue;
                }
                visible.add(todo);
            }
        }
        return visible;
    }

    // ── 查询单条待办 ──────────────────────────────────────────

    public AgentTodo get(String id) {
        AgentTodo todo = todoMapper.selectById(id);
        if (todo == null || todo.getStatus() == 99) {
            throw new BusinessException("TODO002_TODO_NOT_FOUND", "待办不存在");
        }
        if (!canRead(todo, currentUserId())) {
            throw new AccessDeniedException("无权查看该待办");
        }
        return todo;
    }

    // ── 更新待办 ──────────────────────────────────────────────

    @Transactional
    public void update(String id, AgentTodo update) {
        AgentTodo todo = get(id);
        if (!canWrite(todo, currentUserId())) {
            throw new AccessDeniedException("无权编辑该待办");
        }
        update.setId(id);
        update.setUpdateBy(currentUserId());
        todoMapper.updateById(update);
        log.info("待办已更新: id={}", id);
    }

    // ── 删除待办 ──────────────────────────────────────────────

    @Transactional
    public void delete(String id) {
        AgentTodo todo = get(id);
        if (!canWrite(todo, currentUserId())) {
            throw new AccessDeniedException("无权删除该待办");
        }
        todo.setStatus(99);
        todo.setUpdateBy(currentUserId());
        todoMapper.updateById(todo);
        log.info("待办已删除: id={}", id);
    }

    // ── ACL: 行级读权限 ───────────────────────────────────────

    private boolean canRead(AgentTodo todo, String userId) {
        if ("org".equals(todo.getVisibility())) {
            return true;
        }
        if (userId.equals(todo.getAssigneeUserId()) || userId.equals(todo.getCreatedBy())) {
            return true;
        }
        if ("team".equals(todo.getVisibility())) {
            return aclMapper.selectCount(
                    new LambdaQueryWrapper<AgentTodoAcl>()
                            .eq(AgentTodoAcl::getTodoId, todo.getId())
                            .eq(AgentTodoAcl::getStatus, 1)
                            .and(w -> w
                                    .eq(AgentTodoAcl::getSubjectType, "USER").eq(AgentTodoAcl::getSubjectId, userId)
                                    .or()
                                    .in(AgentTodoAcl::getSubjectType, "ROLE", "DEPARTMENT")
                            )
            ) > 0;
        }
        return false;
    }

    // ── ACL: 行级写权限 ───────────────────────────────────────

    private boolean canWrite(AgentTodo todo, String userId) {
        if (userId.equals(todo.getAssigneeUserId()) || userId.equals(todo.getCreatedBy())) {
            return true;
        }
        return aclMapper.selectCount(
                new LambdaQueryWrapper<AgentTodoAcl>()
                        .eq(AgentTodoAcl::getTodoId, todo.getId())
                        .eq(AgentTodoAcl::getPermission, "WRITE")
                        .eq(AgentTodoAcl::getStatus, 1)
                        .and(w -> w
                                .eq(AgentTodoAcl::getSubjectType, "USER").eq(AgentTodoAcl::getSubjectId, userId)
                        )
        ) > 0;
    }

    private String currentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof SystemUser user)) {
            throw new AccessDeniedException("请先登录");
        }
        return user.getId();
    }
}
