package com.efloow.agenthub.system.controller;

import com.efloow.agenthub.common.response.R;
import com.efloow.agenthub.system.dto.ModelTestResultDto;
import com.efloow.agenthub.system.entity.SystemModelProvider;
import com.efloow.agenthub.system.service.ModelProviderService;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/rbac/model-providers")
public class ModelProviderController {

    private final ModelProviderService modelProviderService;

    public ModelProviderController(ModelProviderService modelProviderService) {
        this.modelProviderService = modelProviderService;
    }

    @GetMapping
    public R<List<SystemModelProvider>> list() {
        return R.ok(modelProviderService.listProviders());
    }

    @PostMapping
    public R<String> add(@RequestBody SystemModelProvider provider) {
        return R.ok(modelProviderService.createProvider(provider));
    }

    @PutMapping("/{id}")
    public R<Void> update(@PathVariable String id, @RequestBody SystemModelProvider provider) {
        modelProviderService.updateProvider(id, provider);
        return R.ok(null);
    }

    @DeleteMapping("/{id}")
    public R<Void> delete(@PathVariable String id) {
        modelProviderService.deleteProvider(id);
        return R.ok(null);
    }

    @PostMapping("/{id}/test")
    public R<ModelTestResultDto> test(@PathVariable String id) {
        return R.ok(modelProviderService.testConnection(id));
    }
}
