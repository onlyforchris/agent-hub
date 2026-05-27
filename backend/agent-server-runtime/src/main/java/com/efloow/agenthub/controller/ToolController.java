package com.efloow.agenthub.controller;

import com.efloow.agenthub.application.tool.ToolExecutor;
import com.efloow.agenthub.common.response.R;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/tool")
public class ToolController {

    private final ToolExecutor toolExecutor;

    public ToolController(ToolExecutor toolExecutor) {
        this.toolExecutor = toolExecutor;
    }

    /**
     * Lists registered Tool contracts.
     *
     * @return tool catalog
     */
    @GetMapping("/catalog")
    public R<List<Map<String, Object>>> catalog() {
        return R.ok(toolExecutor.catalog());
    }
}

