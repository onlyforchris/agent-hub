package com.efloow.agenthub.system.mapper;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.apache.ibatis.annotations.MapKey;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface AuditAccessMapper {

    int insertAccess(
            @Param("id") String id,
            @Param("traceId") String traceId,
            @Param("userId") String userId,
            @Param("username") String username,
            @Param("requestMethod") String requestMethod,
            @Param("requestPath") String requestPath,
            @Param("resourceCode") String resourceCode,
            @Param("accessResult") String accessResult,
            @Param("denyReason") String denyReason,
            @Param("clientIp") String clientIp,
            @Param("userAgent") String userAgent,
            @Param("requestTime") Instant requestTime,
            @Param("responseTimeMs") long responseTimeMs,
            @Param("status") int status,
            @Param("remark") String remark,
            @Param("createBy") String createBy
    );

    int insertDetail(
            @Param("id") String id,
            @Param("auditId") String auditId,
            @Param("requestBody") String requestBody,
            @Param("requestParams") String requestParams,
            @Param("responseBody") String responseBody,
            @Param("operationSummary") String operationSummary,
            @Param("status") int status,
            @Param("remark") String remark,
            @Param("createBy") String createBy
    );

    @MapKey("id")
    List<Map<String, Object>> selectRecent(@Param("limit") int limit);
}
