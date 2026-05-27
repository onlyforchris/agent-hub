package com.efloow.agenthub.system.mapper;

import java.util.List;
import java.util.Map;
import org.apache.ibatis.annotations.MapKey;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface RbacMapper {

    List<String> selectPermissionsByUserId(@Param("userId") String userId);

    /**
     * 全部有效 API 资源码（用于超级管理员登录下发权限列表，与 ResourceAuthorizationFilter 语义一致）。
     */
    List<String> selectAllResourceCodes();

    List<String> selectMenuIdsByUserId(@Param("userId") String userId);

    /**
     * 全部有效菜单主键（超级管理员菜单树）。
     */
    List<String> selectAllMenuIds();

    List<String> selectAgentIdsByUserId(@Param("userId") String userId);

    /**
     * 全部有效 Agent 主键（超级管理员 Agent 列表）。
     */
    List<String> selectAllAgentIds();

    String selectMaxDataScopeByUserId(@Param("userId") String userId);

    String selectPermissionByMethodAndPath(@Param("method") String method, @Param("path") String path);

    @MapKey("id")
    List<Map<String, Object>> selectAntResourcesByMethod(@Param("method") String method);

    boolean existsSuperAdminRoleByUserId(@Param("userId") String userId);

    List<String> selectUserIdsByRoleId(@Param("roleId") String roleId);

    @MapKey("id")
    List<Map<String, Object>> selectDepartments();

    @MapKey("id")
    List<Map<String, Object>> selectMenus();

    @MapKey("id")
    List<Map<String, Object>> selectMenusByUserId(@Param("userId") String userId);

    @MapKey("id")
    List<Map<String, Object>> selectResources();

    @MapKey("id")
    List<Map<String, Object>> selectRoles();

    @MapKey("id")
    List<Map<String, Object>> selectUsers();

    @MapKey("id")
    List<Map<String, Object>> selectAgents();

    @MapKey("id")
    List<Map<String, Object>> selectAgentsByUserId(@Param("userId") String userId);

    int insertDepartment(@Param("id") String id, @Param("body") Map<String, Object> body);

    int updateDepartment(@Param("id") String id, @Param("body") Map<String, Object> body);

    int insertMenu(@Param("id") String id, @Param("body") Map<String, Object> body);

    int updateMenu(@Param("id") String id, @Param("body") Map<String, Object> body);

    int insertResource(@Param("id") String id, @Param("body") Map<String, Object> body);

    int updateResource(@Param("id") String id, @Param("body") Map<String, Object> body);

    int insertRole(@Param("id") String id, @Param("body") Map<String, Object> body);

    int updateRole(@Param("id") String id, @Param("body") Map<String, Object> body);

    int insertUser(@Param("id") String id, @Param("passwordHash") String passwordHash, @Param("body") Map<String, Object> body);

    int updateUser(@Param("id") String id, @Param("body") Map<String, Object> body);

    int updateUserPassword(@Param("id") String id, @Param("passwordHash") String passwordHash);

    int insertAgent(@Param("id") String id, @Param("body") Map<String, Object> body);

    int updateAgent(@Param("id") String id, @Param("body") Map<String, Object> body);

    int deleteDepartment(@Param("id") String id, @Param("updateBy") String updateBy);

    int deleteMenu(@Param("id") String id, @Param("updateBy") String updateBy);

    int deleteResource(@Param("id") String id, @Param("updateBy") String updateBy);

    int deleteRole(@Param("id") String id, @Param("updateBy") String updateBy);

    int deleteUser(@Param("id") String id, @Param("updateBy") String updateBy);

    int deleteAgent(@Param("id") String id, @Param("updateBy") String updateBy);

    int deleteUserRoles(@Param("userId") String userId, @Param("updateBy") String updateBy);

    int insertUserRole(@Param("id") String id, @Param("userId") String userId, @Param("roleId") String roleId, @Param("createBy") String createBy);

    int updateUserRoleDataScope(@Param("userId") String userId, @Param("roleId") String roleId, @Param("dataScope") String dataScope, @Param("updateBy") String updateBy);

    List<String> selectRoleIdsByUserId(@Param("userId") String userId);

    int deleteRoleMenus(@Param("roleId") String roleId, @Param("updateBy") String updateBy);

    int insertRoleMenu(@Param("id") String id, @Param("roleId") String roleId, @Param("menuId") String menuId, @Param("createBy") String createBy);

    List<String> selectMenuIdsByRoleId(@Param("roleId") String roleId);

    int deleteRoleResources(@Param("roleId") String roleId, @Param("updateBy") String updateBy);

    int insertRoleResource(@Param("id") String id, @Param("roleId") String roleId, @Param("resourceId") String resourceId, @Param("createBy") String createBy);

    List<String> selectResourceIdsByRoleId(@Param("roleId") String roleId);

    int deleteRoleAgents(@Param("roleId") String roleId, @Param("updateBy") String updateBy);

    int insertRoleAgent(@Param("id") String id, @Param("roleId") String roleId, @Param("agentId") String agentId, @Param("createBy") String createBy);

    List<String> selectAgentIdsByRoleId(@Param("roleId") String roleId);

    List<String> selectUserIdsByDepartmentId(@Param("departmentId") String departmentId);

    List<String> selectAllActiveUserIds();
}
