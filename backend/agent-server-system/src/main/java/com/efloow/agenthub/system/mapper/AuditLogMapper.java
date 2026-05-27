package com.efloow.agenthub.system.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.efloow.agenthub.system.entity.AuditLog;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Mapper
public interface AuditLogMapper extends BaseMapper<AuditLog> {

    @Select("""
        SELECT COALESCE(SUM(input_tokens), 0) AS input_tokens,
               COALESCE(SUM(output_tokens), 0) AS output_tokens,
               COUNT(*) AS call_count,
               COALESCE(SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END), 0) AS failed_count
        FROM audit_log
        WHERE action_type = 'LLM_CALL'
          AND create_time >= #{since}
        """)
    Map<String, Object> aggregateLlmSince(@Param("since") LocalDateTime since);

    @Select("""
        SELECT model_provider AS provider,
               COALESCE(SUM(input_tokens + output_tokens), 0) AS total_tokens,
               COUNT(*) AS call_count
        FROM audit_log
        WHERE action_type = 'LLM_CALL'
          AND create_time >= #{since}
        GROUP BY model_provider
        ORDER BY total_tokens DESC
        """)
    List<Map<String, Object>> tokensByProviderSince(@Param("since") LocalDateTime since);
}
