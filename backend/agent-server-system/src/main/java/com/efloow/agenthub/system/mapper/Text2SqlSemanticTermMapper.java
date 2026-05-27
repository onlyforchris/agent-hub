package com.efloow.agenthub.system.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.efloow.agenthub.system.entity.Text2SqlSemanticTerm;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface Text2SqlSemanticTermMapper extends BaseMapper<Text2SqlSemanticTerm> {

    /** 按数据源（含全局 NULL）查询有效术语列表。 */
    List<Text2SqlSemanticTerm> listByConnection(@Param("connectionId") String connectionId);

    /** 精确匹配术语。 */
    List<Text2SqlSemanticTerm> matchExact(
        @Param("connectionId") String connectionId,
        @Param("term") String term);
}
