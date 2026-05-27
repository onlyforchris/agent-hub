package com.efloow.agenthub.system.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.efloow.agenthub.system.entity.AgentTodo;
import com.efloow.agenthub.system.entity.AgentTodoReminder;
import com.efloow.agenthub.system.mapper.AgentTodoMapper;
import com.efloow.agenthub.system.mapper.AgentTodoReminderMapper;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;

@Component
public class TodoReminderScheduler {

    private static final Logger log = LoggerFactory.getLogger(TodoReminderScheduler.class);
    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final AgentTodoReminderMapper reminderMapper;
    private final AgentTodoMapper todoMapper;
    private final NotificationService notificationService;
    private final TaskScheduler taskScheduler;
    private final Map<String, ScheduledFuture<?>> scheduledTasks = new ConcurrentHashMap<>();

    public TodoReminderScheduler(
            AgentTodoReminderMapper reminderMapper,
            AgentTodoMapper todoMapper,
            NotificationService notificationService,
            TaskScheduler taskScheduler
    ) {
        this.reminderMapper = reminderMapper;
        this.todoMapper = todoMapper;
        this.notificationService = notificationService;
        this.taskScheduler = taskScheduler;
    }

    /**
     * Reload all pending reminders on startup and schedule precise tasks.
     */
    @PostConstruct
    void reloadPending() {
        List<AgentTodoReminder> pending = reminderMapper.selectList(
            new LambdaQueryWrapper<AgentTodoReminder>()
                .eq(AgentTodoReminder::getStatus, 0)
                .gt(AgentTodoReminder::getScheduledAt, LocalDateTime.now())
        );
        log.info("reminder reload: {} pending reminders found, scheduling...", pending.size());
        for (AgentTodoReminder reminder : pending) {
            scheduleReminder(reminder);
        }
    }

    /**
     * Schedule a precise one-shot task for the given reminder.
     * Called when a to_do with reminder is created, and on startup reload.
     */
    public void scheduleReminder(AgentTodoReminder reminder) {
        long delayMs = Duration.between(LocalDateTime.now(), reminder.getScheduledAt()).toMillis();
        if (delayMs <= 0) {
            // Already due — execute immediately via the fallback poll
            log.info("reminder already due, skipping schedule: reminderId={}, scheduledAt={}",
                reminder.getId(), reminder.getScheduledAt());
            return;
        }

        ScheduledFuture<?> future = taskScheduler.schedule(
            () -> fireReminder(reminder.getId()),
            reminder.getScheduledAt().atZone(ZoneId.systemDefault()).toInstant()
        );

        scheduledTasks.put(reminder.getId(), future);
        log.info("reminder scheduled: reminderId={}, todoId={}, scheduledAt={}, delayMs={}",
            reminder.getId(), reminder.getTodoId(),
            reminder.getScheduledAt().format(FMT), delayMs);
    }

    /**
     * Cancel a scheduled reminder (e.g. if the to_do is deleted or reminder changed).
     */
    public void cancelReminder(String reminderId) {
        ScheduledFuture<?> future = scheduledTasks.remove(reminderId);
        if (future != null) {
            future.cancel(false);
            log.info("reminder cancelled: reminderId={}", reminderId);
        }
    }

    /**
     * Execute the reminder: send notification and update status.
     */
    private void fireReminder(String reminderId) {
        scheduledTasks.remove(reminderId);
        AgentTodoReminder reminder = reminderMapper.selectById(reminderId);
        if (reminder == null || reminder.getStatus() != 0) {
            log.debug("reminder already processed or deleted: reminderId={}", reminderId);
            return;
        }

        try {
            AgentTodo todo = todoMapper.selectById(reminder.getTodoId());
            if (todo == null || todo.getStatus() == 99) {
                reminder.setStatus(3);
                reminder.setRemark("待办已删除");
                reminderMapper.updateById(reminder);
                return;
            }

            String title = "待办提醒: " + todo.getTitle();
            String content = "您的待办 **" + todo.getTitle() + "** 已到提醒时间。"
                + (todo.getDueDate() != null
                    ? " 截止日期: " + todo.getDueDate().format(FMT) + "。"
                    : "");

            var notif = notificationService.sendSystem(
                title, content, "TODO",
                reminder.getChannel(), todo.getAssigneeUserId()
            );

            if (notif != null) {
                reminder.setStatus(1);
                reminder.setSentAt(LocalDateTime.now());
                reminderMapper.updateById(reminder);
                log.info("reminder fired: notifId={}, todoId={}, title={}",
                    notif.getId(), todo.getId(), todo.getTitle());
            } else {
                log.warn("reminder fire returned null: todoId={}", todo.getId());
            }
        } catch (Exception e) {
            log.error("reminder fire failed: reminderId={}, todoId={}", reminderId, e);
            handleRetry(reminder, e);
        }
    }

    private void handleRetry(AgentTodoReminder reminder, Exception e) {
        int retries = reminder.getRetryCount() != null ? reminder.getRetryCount() : 0;
        if (retries < 4) {
            long[] backoffMinutes = {1, 5, 15, 60};
            reminder.setRetryCount(retries + 1);
            reminder.setScheduledAt(LocalDateTime.now().plusMinutes(backoffMinutes[retries]));
            reminder.setRemark("retry " + (retries + 1) + ": " + e.getMessage());
            reminderMapper.updateById(reminder);
            // Re-schedule for retry
            scheduleReminder(reminder);
        } else {
            reminder.setStatus(2);
            reminder.setRemark("failed after " + retries + " retries: " + e.getMessage());
            reminderMapper.updateById(reminder);
        }
    }

    /**
     * Fallback poll every 5 minutes to catch any reminders missed due to
     * restart timing or edge cases. Individual reminders are handled by
     * the TaskScheduler — this is only a safety net.
     */
    @Scheduled(fixedDelay = 300_000)
    public void fallbackPoll() {
        List<AgentTodoReminder> missed = reminderMapper.selectList(
            new LambdaQueryWrapper<AgentTodoReminder>()
                .eq(AgentTodoReminder::getStatus, 0)
                .le(AgentTodoReminder::getScheduledAt, LocalDateTime.now())
        );

        for (AgentTodoReminder reminder : missed) {
            if (!scheduledTasks.containsKey(reminder.getId())) {
                log.info("fallback poll caught missed reminder: reminderId={}", reminder.getId());
                fireReminder(reminder.getId());
            }
        }
    }
}
