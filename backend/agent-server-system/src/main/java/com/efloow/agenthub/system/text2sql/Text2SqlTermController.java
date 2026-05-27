package com.efloow.agenthub.system.text2sql;

import com.efloow.agenthub.common.response.R;
import com.efloow.agenthub.system.service.RbacService;
import com.efloow.agenthub.system.text2sql.dto.Text2SqlTermCreateRequest;
import com.efloow.agenthub.system.text2sql.dto.Text2SqlTermUpdateRequest;
import com.efloow.agenthub.system.text2sql.dto.Text2SqlTermVo;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/text2sql/terms")
public class Text2SqlTermController {

    private final Text2SqlTermService termService;
    private final RbacService rbacService;

    public Text2SqlTermController(Text2SqlTermService termService, RbacService rbacService) {
        this.termService = termService;
        this.rbacService = rbacService;
    }

    @GetMapping
    public R<List<Text2SqlTermVo>> list(@RequestParam("connectionId") String connectionId) {
        return R.ok(termService.listByConnection(connectionId));
    }

    @GetMapping("/{id}")
    public R<Text2SqlTermVo> detail(@PathVariable String id) {
        return R.ok(termService.getById(id));
    }

    @PostMapping
    public R<String> create(@Valid @RequestBody Text2SqlTermCreateRequest body) {
        String userId = rbacService.currentUser().getId();
        return R.ok(termService.create(body, userId));
    }

    @PutMapping("/{id}")
    public R<Void> update(@PathVariable String id, @Valid @RequestBody Text2SqlTermUpdateRequest body) {
        String userId = rbacService.currentUser().getId();
        termService.update(id, body, userId);
        return R.ok(null);
    }

    @DeleteMapping("/{id}")
    public R<Void> delete(@PathVariable String id) {
        String userId = rbacService.currentUser().getId();
        termService.delete(id, userId);
        return R.ok(null);
    }
}
