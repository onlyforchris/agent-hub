package com.efloow.agenthub.system.mapper;

import java.time.LocalDateTime;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface TokenMapper {

    int insertRefreshToken(
            @Param("id") String id,
            @Param("tokenId") String tokenId,
            @Param("userId") String userId,
            @Param("expireTime") LocalDateTime expireTime,
            @Param("createBy") String createBy
    );

    int revokeRefreshToken(@Param("tokenId") String tokenId, @Param("userId") String userId, @Param("updateBy") String updateBy);

    int revokeAllRefreshTokensByUserId(@Param("userId") String userId, @Param("updateBy") String updateBy);

    boolean existsActiveRefreshToken(@Param("tokenId") String tokenId);

    int insertTokenBlacklist(
            @Param("id") String id,
            @Param("tokenId") String tokenId,
            @Param("userId") String userId,
            @Param("tokenType") String tokenType,
            @Param("expireTime") LocalDateTime expireTime,
            @Param("invalidatedBy") String invalidatedBy,
            @Param("createBy") String createBy
    );

    boolean existsBlacklistedToken(@Param("tokenId") String tokenId);
}
