package com.efloow.agenthub;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class AgentHubApplication {

    private static final Logger logger = LoggerFactory.getLogger(AgentHubApplication.class);

    public static void main(String[] args) {
        logger.info("亿流Agent基座启动中...");
        try {
            SpringApplication.run(AgentHubApplication.class, args);
        } catch (Exception e) {
            logger.error("应用启动失败", e);
        }
        logger.info("""
                
                ╔═══════════════════════════════════════════════╗
                ║  Yl Agent Hub Started                         ║
                ║  Swagger: http://localhost:8066/api/doc.html  ║
                ╚═══════════════════════════════════════════════╝
                """);
    }
}

