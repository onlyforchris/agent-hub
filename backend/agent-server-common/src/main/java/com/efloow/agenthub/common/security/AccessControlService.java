package com.efloow.agenthub.common.security;

public interface AccessControlService {

    void assertPermission(String permission);

    void assertAgentAccess(String agentId);
}
