package com.efloow.agenthub.system.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.efloow.agenthub.system.entity.AgentNotificationReceipt;
import java.util.Map;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface AgentNotificationReceiptMapper extends BaseMapper<AgentNotificationReceipt> {

    @Update("UPDATE agent_notification_receipt SET is_read = 1, read_at = LOCALTIMESTAMP(6) "
            + "WHERE recipient_id = #{recipientId} AND is_read = 0 AND is_deleted = 0")
    int markAllRead(@Param("recipientId") String recipientId);

    Page<Map<String, Object>> selectMyNotifications(Page<Map<String, Object>> page, @Param("userId") String userId);
}
