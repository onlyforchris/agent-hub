package com.efloow.agenthub.system.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.efloow.agenthub.system.entity.Text2SqlTableEmbedding;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface Text2SqlTableEmbeddingMapper extends BaseMapper<Text2SqlTableEmbedding> {

    /** 按连接删除旧向量（重建索引前清理）。 */
    int deleteByConnectionId(@Param("connectionId") String connectionId);

    /**
     * 余弦相似度检索 Top-K 表。
     * @param connectionId 数据源
     * @param embedding pgvector 格式字符串 "[x,y,...]"
     * @param limit Top-K
     * @return 按相似度降序排列
     */
    List<Text2SqlTableEmbedding> searchSimilar(
        @Param("connectionId") String connectionId,
        @Param("embedding") String embedding,
        @Param("limit") int limit);
}
