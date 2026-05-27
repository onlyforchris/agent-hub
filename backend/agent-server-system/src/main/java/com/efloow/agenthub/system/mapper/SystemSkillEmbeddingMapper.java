package com.efloow.agenthub.system.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.efloow.agenthub.system.entity.SystemSkillEmbedding;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface SystemSkillEmbeddingMapper extends BaseMapper<SystemSkillEmbedding> {

    int deleteBySkillId(@Param("skillId") String skillId);

    List<SystemSkillEmbedding> searchSimilar(
            @Param("embedding") String embedding,
            @Param("skillIds") List<String> skillIds,
            @Param("limit") int limit
    );
}
