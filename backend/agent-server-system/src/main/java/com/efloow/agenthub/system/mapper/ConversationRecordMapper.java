package com.efloow.agenthub.system.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.efloow.agenthub.system.entity.ConversationRecord;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;

@Mapper
public interface ConversationRecordMapper extends BaseMapper<ConversationRecord> {

    @Select("""
        SELECT session_id,
               MAX(user_id) AS user_id,
               MAX(agent_id) AS agent_id,
               COUNT(*) AS turn_count,
               MAX(create_time) AS last_time,
               LEFT(MAX(user_input), 80) AS last_input
        FROM conversation_record
        WHERE (#{sessionId} IS NULL OR #{sessionId} = '' OR session_id = #{sessionId})
          AND (#{agentId} IS NULL OR #{agentId} = '' OR agent_id = #{agentId})
        GROUP BY session_id
        ORDER BY last_time DESC
        LIMIT #{limit} OFFSET #{offset}
        """)
    List<Map<String, Object>> listSessionSummaries(
            @Param("sessionId") String sessionId,
            @Param("agentId") String agentId,
            @Param("limit") int limit,
            @Param("offset") int offset
    );

    @Select("""
        SELECT COUNT(DISTINCT session_id)
        FROM conversation_record
        WHERE (#{sessionId} IS NULL OR #{sessionId} = '' OR session_id = #{sessionId})
          AND (#{agentId} IS NULL OR #{agentId} = '' OR agent_id = #{agentId})
        """)
    long countDistinctSessions(@Param("sessionId") String sessionId, @Param("agentId") String agentId);
}
