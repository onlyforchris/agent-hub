package com.efloow.agenthub.system.dto;

import java.util.List;

public record PageResult<T>(long total, int page, int pageSize, List<T> records) {
}
