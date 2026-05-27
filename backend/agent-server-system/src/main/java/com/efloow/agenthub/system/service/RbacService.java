package com.efloow.agenthub.system.service;

import com.efloow.agenthub.common.exception.BusinessException;
import com.efloow.agenthub.common.security.AccessControlService;
import com.efloow.agenthub.system.entity.SystemUser;
import com.efloow.agenthub.system.mapper.RbacMapper;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.AntPathMatcher;

@Service
public class RbacService implements AccessControlService {

    private final RbacMapper rbacMapper;
    private final PasswordEncoder passwordEncoder;
    private final StringRedisTemplate redisTemplate;
    private final AntPathMatcher pathMatcher = new AntPathMatcher();
    private final Map<String, CacheValue<Set<String>>> permissionCache = new ConcurrentHashMap<>();
    private final Map<String, CacheValue<Set<String>>> agentCache = new ConcurrentHashMap<>();
    private final Duration cacheTtl = Duration.ofMinutes(30);

    public RbacService(
            RbacMapper rbacMapper,
            PasswordEncoder passwordEncoder,
            ObjectProvider<StringRedisTemplate> redisTemplateProvider
    ) {
        this.rbacMapper = rbacMapper;
        this.passwordEncoder = passwordEncoder;
        this.redisTemplate = redisTemplateProvider.getIfAvailable();
    }

    /**
     * 从 Spring Security 上下文获取当前登录用户。
     */
    public SystemUser currentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof SystemUser user)) {
            throw new AccessDeniedException("请先登录");
        }
        return user;
    }

    /**
     * 查询当前用户拥有的全部 API 权限码。
     */
    public List<String> currentPermissions() {
        return permissionsByUser(currentUser().getId());
    }

    /**
     * 查询指定用户拥有的全部 API 权限码。
     */
    public List<String> permissionsByUser(String userId) {
        return new ArrayList<>(cachedSet(permissionCache, userId, () -> {
            if (rbacMapper.existsSuperAdminRoleByUserId(userId)) {
                return rbacMapper.selectAllResourceCodes();
            }
            return rbacMapper.selectPermissionsByUserId(userId);
        }));
    }

    /**
     * 查询指定用户拥有的菜单 ID。
     */
    public List<String> menuIdsByUser(String userId) {
        if (rbacMapper.existsSuperAdminRoleByUserId(userId)) {
            return rbacMapper.selectAllMenuIds();
        }
        return rbacMapper.selectMenuIdsByUserId(userId);
    }

    /**
     * 查询指定用户拥有的智能体 ID。
     */
    public List<String> agentIdsByUser(String userId) {
        return new ArrayList<>(cachedSet(agentCache, userId, () -> {
            if (rbacMapper.existsSuperAdminRoleByUserId(userId)) {
                return rbacMapper.selectAllAgentIds();
            }
            return rbacMapper.selectAgentIdsByUserId(userId);
        }));
    }

    public String dataScopeByUser(String userId) {
        return rbacMapper.selectMaxDataScopeByUserId(userId);
    }

    /**
     * 根据请求方法和路径解析 API 权限码。
     */
    public String permissionByMethodAndPath(String method, String path) {
        String permission = rbacMapper.selectPermissionByMethodAndPath(method, path);
        if (permission != null && !permission.isBlank()) {
            return permission;
        }
        for (Map<String, Object> resource : rbacMapper.selectAntResourcesByMethod(method)) {
            String pattern = String.valueOf(resource.get("path"));
            if (pathMatcher.match(pattern, path)) {
                return String.valueOf(resource.get("resourceCode"));
            }
        }
        return null;
    }

    @Override
    public void assertPermission(String permission) {
        SystemUser user = currentUser();
        if (hasSuperAdminRole(user)) {
            return;
        }
        if (!permissionsByUser(user.getId()).contains(permission)) {
            throw new AccessDeniedException("缺少权限：" + permission);
        }
    }

    @Override
    public void assertAgentAccess(String agentId) {
        SystemUser user = currentUser();
        if (hasSuperAdminRole(user)) {
            return;
        }
        if (agentId == null || !agentIdsByUser(user.getId()).contains(agentId)) {
            throw new AccessDeniedException("无权访问该智能体");
        }
    }

    public List<Map<String, Object>> departmentTree() {
        return tree(listDepartments(), "parentId");
    }

    public List<Map<String, Object>> listDepartments() {
        return rbacMapper.selectDepartments();
    }

    public List<Map<String, Object>> menuTree(boolean currentUserOnly) {
        List<Map<String, Object>> rows = currentUserOnly
                ? rbacMapper.selectMenusByUserId(currentUser().getId())
                : listMenus();
        return tree(rows, "parentId");
    }

    public List<Map<String, Object>> listMenus() {
        return rbacMapper.selectMenus();
    }

    public List<Map<String, Object>> listResources() {
        return rbacMapper.selectResources();
    }

    public List<Map<String, Object>> listRoles() {
        return rbacMapper.selectRoles();
    }

    public List<Map<String, Object>> listUsers() {
        return rbacMapper.selectUsers();
    }

    public List<Map<String, Object>> listAuthorizedAgents() {
        SystemUser user = currentUser();
        if (hasSuperAdminRole(user)) {
            return listAgents();
        }
        return rbacMapper.selectAgentsByUserId(user.getId());
    }

    public List<Map<String, Object>> listAgents() {
        return rbacMapper.selectAgents();
    }

    @Transactional
    public String createDepartment(Map<String, Object> body) {
        requireAny(body, "deptCode", "deptName");
        setDefault(body, "sortOrder", 0);
        setDefault(body, "status", 1);
        body.put("createBy", currentUserId());
        String id = newId();
        rbacMapper.insertDepartment(id, body);
        return id;
    }

    @Transactional
    public void updateDepartment(String id, Map<String, Object> body) {
        body.put("updateBy", currentUserId());
        rbacMapper.updateDepartment(id, body);
    }

    @Transactional
    public void deleteDepartment(String id) {
        rbacMapper.deleteDepartment(id, currentUserId());
    }

    @Transactional
    public String createMenu(Map<String, Object> body) {
        requireAny(body, "menuName");
        setDefault(body, "sortOrder", 0);
        setDefault(body, "status", 1);
        body.put("createBy", currentUserId());
        String id = newId();
        rbacMapper.insertMenu(id, body);
        return id;
    }

    @Transactional
    public void updateMenu(String id, Map<String, Object> body) {
        body.put("updateBy", currentUserId());
        rbacMapper.updateMenu(id, body);
    }

    @Transactional
    public void deleteMenu(String id) {
        rbacMapper.deleteMenu(id, currentUserId());
    }

    @Transactional
    public String createResource(Map<String, Object> body) {
        requireAny(body, "resourceName", "resourceCode", "method", "path");
        setDefault(body, "resourceType", "API");
        setDefault(body, "matchType", "EXACT");
        setDefault(body, "priority", 0);
        setDefault(body, "status", 1);
        body.put("createBy", currentUserId());
        String id = newId();
        rbacMapper.insertResource(id, body);
        return id;
    }

    @Transactional
    public void updateResource(String id, Map<String, Object> body) {
        body.put("updateBy", currentUserId());
        rbacMapper.updateResource(id, body);
        clearPermissionCaches();
    }

    @Transactional
    public String createRole(Map<String, Object> body) {
        requireAny(body, "roleCode", "roleName");
        setDefault(body, "roleType", "NORMAL");
        setDefault(body, "sortOrder", 0);
        setDefault(body, "status", 1);
        body.put("createBy", currentUserId());
        String id = newId();
        rbacMapper.insertRole(id, body);
        return id;
    }

    @Transactional
    public void updateRole(String id, Map<String, Object> body) {
        body.put("updateBy", currentUserId());
        rbacMapper.updateRole(id, body);
        evictCachesByRole(id);
    }

    @Transactional
    public String createUser(Map<String, Object> body) {
        requireAny(body, "username");
        setDefault(body, "status", 1);
        body.put("createBy", currentUserId());
        String id = newId();
        String rawPassword = String.valueOf(body.getOrDefault("password", "Eflow@123456"));
        rbacMapper.insertUser(id, passwordEncoder.encode(rawPassword), body);
        return id;
    }

    @Transactional
    public void updateUser(String id, Map<String, Object> body) {
        body.put("updateBy", currentUserId());
        rbacMapper.updateUser(id, body);
        if (body.get("password") != null && !String.valueOf(body.get("password")).isBlank()) {
            rbacMapper.updateUserPassword(id, passwordEncoder.encode(String.valueOf(body.get("password"))));
        }
        evictUserCaches(id);
    }

    @Transactional
    public String createAgent(Map<String, Object> body) {
        requireAny(body, "agentCode", "agentName");
        setDefault(body, "permissionLevel", 1);
        setDefault(body, "status", 1);
        body.put("createBy", currentUserId());
        String id = newId();
        rbacMapper.insertAgent(id, body);
        return id;
    }

    @Transactional
    public void updateAgent(String id, Map<String, Object> body) {
        body.put("updateBy", currentUserId());
        rbacMapper.updateAgent(id, body);
        agentCache.clear();
    }

    @Transactional
    public void deleteResource(String id) {
        rbacMapper.deleteResource(id, currentUserId());
        clearPermissionCaches();
    }

    @Transactional
    public void deleteRole(String id) {
        evictCachesByRole(id);
        rbacMapper.deleteRole(id, currentUserId());
    }

    @Transactional
    public void deleteUser(String id) {
        rbacMapper.deleteUser(id, currentUserId());
        evictUserCaches(id);
    }

    @Transactional
    public void deleteAgent(String id) {
        rbacMapper.deleteAgent(id, currentUserId());
        agentCache.clear();
    }

    @Transactional
    public void assignUserRoles(String userId, List<String> roleIds, String dataScope) {
        String normalizedDataScope = normalizeDataScope(dataScope);
        String updateBy = currentUserId();
        rbacMapper.deleteUserRoles(userId, updateBy);
        for (String roleId : roleIds) {
            rbacMapper.insertUserRole(newId(), userId, roleId, updateBy);
            rbacMapper.updateUserRoleDataScope(userId, roleId, normalizedDataScope, updateBy);
        }
        evictUserCaches(userId);
    }

    @Transactional
    public void assignRoleMenus(String roleId, List<String> menuIds) {
        String updateBy = currentUserId();
        rbacMapper.deleteRoleMenus(roleId, updateBy);
        for (String menuId : menuIds) {
            rbacMapper.insertRoleMenu(newId(), roleId, menuId, updateBy);
        }
        evictCachesByRole(roleId);
    }

    @Transactional
    public void assignRoleResources(String roleId, List<String> resourceIds) {
        String updateBy = currentUserId();
        rbacMapper.deleteRoleResources(roleId, updateBy);
        for (String resourceId : resourceIds) {
            rbacMapper.insertRoleResource(newId(), roleId, resourceId, updateBy);
        }
        evictCachesByRole(roleId);
    }

    @Transactional
    public void assignRoleAgents(String roleId, List<String> agentIds) {
        String updateBy = currentUserId();
        rbacMapper.deleteRoleAgents(roleId, updateBy);
        for (String agentId : agentIds) {
            rbacMapper.insertRoleAgent(newId(), roleId, agentId, updateBy);
        }
        evictCachesByRole(roleId);
    }

    public List<String> roleIdsByUser(String userId) {
        return rbacMapper.selectRoleIdsByUserId(userId);
    }

    public List<String> menuIdsByRole(String roleId) {
        return rbacMapper.selectMenuIdsByRoleId(roleId);
    }

    public List<String> resourceIdsByRole(String roleId) {
        return rbacMapper.selectResourceIdsByRoleId(roleId);
    }

    public List<String> agentIdsByRole(String roleId) {
        return rbacMapper.selectAgentIdsByRoleId(roleId);
    }

    public boolean hasSuperAdminRole(SystemUser user) {
        return user != null && rbacMapper.existsSuperAdminRoleByUserId(user.getId());
    }

    private Set<String> cachedSet(Map<String, CacheValue<Set<String>>> cache, String userId, UserValueLoader loader) {
        CacheValue<Set<String>> cached = cache.get(userId);
        Instant now = Instant.now();
        if (cached != null && cached.expiresAt().isAfter(now)) {
            return cached.value();
        }
        String redisKey = cache == permissionCache ? "rbac:perm:" + userId : "rbac:agent:" + userId;
        Set<String> redisValue = readRedisSet(redisKey);
        if (redisValue != null) {
            cache.put(userId, new CacheValue<>(redisValue, now.plus(cacheTtl)));
            return redisValue;
        }
        Set<String> fresh = Collections.unmodifiableSet(new HashSet<>(loader.load()));
        cache.put(userId, new CacheValue<>(fresh, now.plus(cacheTtl)));
        writeRedisSet(redisKey, fresh);
        return fresh;
    }

    private void evictUserCaches(String userId) {
        permissionCache.remove(userId);
        agentCache.remove(userId);
        deleteRedisKey("rbac:perm:" + userId);
        deleteRedisKey("rbac:agent:" + userId);
    }

    private void evictCachesByRole(String roleId) {
        for (String userId : rbacMapper.selectUserIdsByRoleId(roleId)) {
            evictUserCaches(userId);
        }
    }

    private void clearPermissionCaches() {
        permissionCache.clear();
        if (redisTemplate != null) {
            try {
                Set<String> keys = redisTemplate.keys("rbac:perm:*");
                if (keys != null && !keys.isEmpty()) {
                    redisTemplate.delete(keys);
                }
            } catch (Exception ignored) {
            }
        }
    }

    private Set<String> readRedisSet(String key) {
        if (redisTemplate == null) {
            return null;
        }
        try {
            Set<String> members = redisTemplate.opsForSet().members(key);
            if (members == null || members.isEmpty()) {
                return null;
            }
            return Collections.unmodifiableSet(new HashSet<>(members));
        } catch (Exception ignored) {
            return null;
        }
    }

    private void writeRedisSet(String key, Set<String> values) {
        if (redisTemplate == null || values.isEmpty()) {
            return;
        }
        try {
            redisTemplate.opsForSet().add(key, values.toArray(String[]::new));
            redisTemplate.expire(key, cacheTtl);
        } catch (Exception ignored) {
        }
    }

    private void deleteRedisKey(String key) {
        if (redisTemplate == null) {
            return;
        }
        try {
            redisTemplate.delete(key);
        } catch (Exception ignored) {
        }
    }

    private void requireAny(Map<String, Object> body, String... keys) {
        for (String key : keys) {
            if (!body.containsKey(key) || body.get(key) == null || String.valueOf(body.get(key)).isBlank()) {
                throw new BusinessException("C001_EMPTY_BODY", "缺少必填字段：" + key);
            }
        }
    }

    private String currentUserId() {
        return currentUser().getId();
    }

    private String newId() {
        return UUID.randomUUID().toString();
    }

    private String normalizeDataScope(Object dataScope) {
        if (dataScope == null) {
            return "SELF";
        }
        String value = String.valueOf(dataScope);
        return switch (value) {
            case "DEPT", "DEPT_AND_SUB", "ALL" -> value;
            default -> "SELF";
        };
    }

    private void setDefault(Map<String, Object> body, String key, Object value) {
        if (!body.containsKey(key) || body.get(key) == null) {
            body.put(key, value);
        }
    }

    private List<Map<String, Object>> tree(List<Map<String, Object>> rows, String parentKey) {
        Map<String, Map<String, Object>> byId = new LinkedHashMap<>();
        rows.forEach(row -> {
            row.put("children", new ArrayList<Map<String, Object>>());
            byId.put(String.valueOf(row.get("id")), row);
        });
        List<Map<String, Object>> roots = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Object parentId = row.get(parentKey);
            if (parentId == null || String.valueOf(parentId).isBlank() || !byId.containsKey(String.valueOf(parentId))) {
                roots.add(row);
            } else {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> children = (List<Map<String, Object>>) byId.get(String.valueOf(parentId)).get("children");
                children.add(row);
            }
        }
        return roots;
    }

    private record CacheValue<T>(T value, Instant expiresAt) {
    }

    @FunctionalInterface
    private interface UserValueLoader {
        List<String> load();
    }
}
