package com.efloow.agenthub.domain.agent;

import java.util.Collections;
import java.util.Map;

public record Intent(
    String action,
    Map<String, Object> params,
    double confidence
) {

    public Intent(String action) {
        this(action, Collections.emptyMap(), 1.0);
    }

    public Intent(String action, Map<String, Object> params) {
        this(action, params, 1.0);
    }

    public Object param(String key) {
        return params != null ? params.get(key) : null;
    }

    public String paramString(String key) {
        Object val = param(key);
        return val != null ? val.toString() : null;
    }
}
