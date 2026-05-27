package com.efloow.agenthub.system.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.efloow.agenthub.system.entity.Text2SqlColumnEmbedding;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface Text2SqlColumnEmbeddingMapper extends BaseMapper<Text2SqlColumnEmbedding> {

    int deleteByConnectionId(@Param("connectionId") String connectionId);

    /**
     * 在候选表范围内做列级相似度检索。
     */
    List<Text2SqlColumnEmbedding> searchSimilarInTables(
        @Param("connectionId") String connectionId,
        @Param("embedding") String embedding,
        @Param("tableNames") List<String> tableNames,
        @Param("limit") int limit);
}
