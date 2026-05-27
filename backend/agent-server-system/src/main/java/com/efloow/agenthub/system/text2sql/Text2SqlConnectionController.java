package com.efloow.agenthub.system.text2sql;

import com.efloow.agenthub.common.response.R;
import com.efloow.agenthub.system.text2sql.dto.RetrievalContext;
import com.efloow.agenthub.system.text2sql.dto.SchemaSnapshot;
import com.efloow.agenthub.system.text2sql.dto.Text2SqlConnectionCreateRequest;
import com.efloow.agenthub.system.text2sql.dto.Text2SqlConnectionProbeRequest;
import com.efloow.agenthub.system.text2sql.dto.Text2SqlConnectionUpdateRequest;
import com.efloow.agenthub.system.text2sql.dto.Text2SqlConnectionVo;
import com.efloow.agenthub.system.text2sql.dto.Text2SqlMetadataResponse;
import com.efloow.agenthub.system.service.RbacService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Text2SQL 数据源连接（系统连接器）REST 接口。
 */
@RestController
@RequestMapping("/api/text2sql/connectors")
public class Text2SqlConnectionController {

    private final Text2SqlConnectionService connectionService;
    private final Text2SqlIndexService indexService;
    private final Text2SqlRetrievalService retrievalService;
    private final RbacService rbacService;

    public Text2SqlConnectionController(Text2SqlConnectionService connectionService,
            Text2SqlIndexService indexService,
            Text2SqlRetrievalService retrievalService,
            RbacService rbacService) {
        this.connectionService = connectionService;
        this.indexService = indexService;
        this.retrievalService = retrievalService;
        this.rbacService = rbacService;
    }

    @GetMapping
    public R<List<Text2SqlConnectionVo>> list() {
        return R.ok(connectionService.listActive());
    }

    @GetMapping("/{id}")
    public R<Text2SqlConnectionVo> detail(@PathVariable String id) {
        return R.ok(connectionService.getActive(id));
    }

    @PostMapping
    public R<String> create(@Valid @RequestBody Text2SqlConnectionCreateRequest body) {
        String userId = rbacService.currentUser().getId();
        return R.ok(connectionService.create(body, userId));
    }

    @PutMapping("/{id}")
    public R<Void> update(@PathVariable String id, @Valid @RequestBody Text2SqlConnectionUpdateRequest body) {
        String userId = rbacService.currentUser().getId();
        connectionService.update(id, body, userId);
        return R.ok(null);
    }

    @DeleteMapping("/{id}")
    public R<Void> delete(@PathVariable String id) {
        String userId = rbacService.currentUser().getId();
        connectionService.delete(id, userId);
        return R.ok(null);
    }

    @PostMapping("/test")
    public R<Void> test(@Valid @RequestBody Text2SqlConnectionProbeRequest body) {
        connectionService.probe(body);
        return R.ok(null);
    }

    @PostMapping("/{id}/test")
    public R<Void> testSaved(@PathVariable String id) {
        connectionService.testSaved(id);
        return R.ok(null);
    }

    @GetMapping("/{id}/metadata")
    public R<Text2SqlMetadataResponse> metadata(@PathVariable String id) {
        return R.ok(connectionService.metadata(id));
    }

    @PostMapping("/{id}/schema/refresh")
    public R<Void> refreshSchema(@PathVariable String id) {
        connectionService.refreshSchema(id);
        return R.ok(null);
    }

    @GetMapping("/{id}/schema")
    public R<SchemaSnapshot> getSchema(@PathVariable String id) {
        return R.ok(connectionService.getSchema(id));
    }

    @PostMapping("/{id}/index/build")
    public R<Integer> buildIndex(@PathVariable String id) {
        int count = indexService.buildIndex(id);
        return R.ok(count);
    }

    @PostMapping("/{id}/retrieve")
    public R<RetrievalContext> retrieve(@PathVariable String id, @RequestBody RetrieveRequest body) {
        return R.ok(retrievalService.retrieve(id, body.question()));
    }

    public record RetrieveRequest(String question) {}
}
