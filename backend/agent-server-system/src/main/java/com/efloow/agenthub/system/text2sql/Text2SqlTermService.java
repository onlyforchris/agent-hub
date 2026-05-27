package com.efloow.agenthub.system.text2sql;

import com.efloow.agenthub.system.entity.Text2SqlSemanticTerm;
import com.efloow.agenthub.system.mapper.Text2SqlSemanticTermMapper;
import com.efloow.agenthub.system.text2sql.dto.Text2SqlTermCreateRequest;
import com.efloow.agenthub.system.text2sql.dto.Text2SqlTermUpdateRequest;
import com.efloow.agenthub.system.text2sql.dto.Text2SqlTermVo;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class Text2SqlTermService {

    private final Text2SqlSemanticTermMapper termMapper;

    public Text2SqlTermService(Text2SqlSemanticTermMapper termMapper) {
        this.termMapper = termMapper;
    }

    public List<Text2SqlTermVo> listByConnection(String connectionId) {
        return termMapper.listByConnection(connectionId).stream()
            .map(this::toVo)
            .toList();
    }

    public Text2SqlTermVo getById(String id) {
        Text2SqlSemanticTerm t = termMapper.selectById(id);
        if (t == null || t.getStatus() == 2) {
            throw new IllegalArgumentException("术语不存在: " + id);
        }
        return toVo(t);
    }

    @Transactional
    public String create(Text2SqlTermCreateRequest req, String userId) {
        Text2SqlSemanticTerm t = new Text2SqlSemanticTerm();
        t.setId("term-" + UUID.randomUUID().toString().substring(0, 8));
        t.setConnectionId(req.connectionId());
        t.setTerm(req.term());
        t.setTermType(req.termType());
        t.setTableName(req.tableName());
        t.setColumnName(req.columnName());
        t.setFormula(req.formula());
        t.setFilterCondition(req.filterCondition());
        t.setPriority(req.priority() != null ? req.priority() : 0);
        t.setStatus(1);
        t.setCreateBy(userId);
        t.setCreateTime(LocalDateTime.now());
        t.setUpdateBy(userId);
        t.setUpdateTime(LocalDateTime.now());
        termMapper.insert(t);
        return t.getId();
    }

    @Transactional
    public void update(String id, Text2SqlTermUpdateRequest req, String userId) {
        Text2SqlSemanticTerm t = termMapper.selectById(id);
        if (t == null || t.getStatus() == 2) {
            throw new IllegalArgumentException("术语不存在: " + id);
        }
        t.setConnectionId(req.connectionId());
        t.setTerm(req.term());
        t.setTermType(req.termType());
        t.setTableName(req.tableName());
        t.setColumnName(req.columnName());
        t.setFormula(req.formula());
        t.setFilterCondition(req.filterCondition());
        t.setPriority(req.priority() != null ? req.priority() : t.getPriority());
        t.setUpdateBy(userId);
        t.setUpdateTime(LocalDateTime.now());
        termMapper.updateById(t);
    }

    @Transactional
    public void delete(String id, String userId) {
        Text2SqlSemanticTerm t = termMapper.selectById(id);
        if (t == null || t.getStatus() == 2) {
            throw new IllegalArgumentException("术语不存在: " + id);
        }
        t.setStatus(2);
        t.setUpdateBy(userId);
        t.setUpdateTime(LocalDateTime.now());
        termMapper.updateById(t);
    }

    private Text2SqlTermVo toVo(Text2SqlSemanticTerm t) {
        return new Text2SqlTermVo(
            t.getId(),
            t.getConnectionId(),
            t.getTerm(),
            t.getTermType(),
            t.getTableName(),
            t.getColumnName(),
            t.getFormula(),
            t.getFilterCondition(),
            t.getPriority(),
            t.getStatus(),
            t.getRemark(),
            t.getCreateBy(),
            t.getCreateTime() != null ? t.getCreateTime().toString() : null,
            t.getUpdateBy(),
            t.getUpdateTime() != null ? t.getUpdateTime().toString() : null
        );
    }
}
