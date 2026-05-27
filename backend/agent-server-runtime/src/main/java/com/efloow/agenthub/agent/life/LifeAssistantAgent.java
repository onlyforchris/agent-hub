package com.efloow.agenthub.agent.life;

import com.efloow.agenthub.base.ReActAgentBase;
import com.efloow.agenthub.domain.agent.AgentInfo;
import com.efloow.agenthub.domain.agent.AgentInfo.SkillInfo;
import com.efloow.agenthub.domain.agent.ConfirmRequest.RiskLevel;
import com.efloow.agenthub.domain.agent.ToolDef;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class LifeAssistantAgent extends ReActAgentBase {

    private static final AgentInfo INFO = AgentInfo.builder()
        .id("life-assistant")
        .name("通用助手")
        .description("处理日期时间、天气查询和个人待办等轻量任务")
        .permissionLevel(1)
        .skills(List.of(
            new SkillInfo("time", "日期时间", "查询当前日期、星期和本地时间"),
            new SkillInfo("weather", "天气查询", "按城市查询天气概况"),
            new SkillInfo("todo", "待办管理", "创建和查看个人待办, 预留日历、提醒和 RBAC 扩展")
        ))
        .toolIds(List.of("system.time.now", "weather.lookup", "todo.create", "todo.list"))
        .build();

    @Override
    public AgentInfo info() {
        return INFO;
    }

    @Override
    public String routeHint() {
        return "日期、星期、现在几点、天气、气温、下雨、待办、todo、提醒、日程、日历";
    }

    @Override
    public String systemPromptBase() {
        return ""
            + "你是通用事务助手, 负责处理确定性轻量任务.\n"
            + "\n"
            + "## 核心规则\n"
            + "- 新建、修改或删除待办前, 必须先用 CONFIRM_NEEDED 向用户确认操作内容, 用户确认后才能执行对应工具.\n"
            + "- 确认信息中必须包含: 待办标题、提醒时间、截止日期(如有), 让用户核对.\n"
            + "- 查看待办(todo.list)不需要确认, 直接执行.\n"
            + "\n"
            + "## 能力边界\n"
            + "- 询问当前日期、星期或时间时, 必须调用 system.time.now.\n"
            + "- 询问天气时, 必须同时具备日期和地点后才能调用 weather.lookup.\n"
            + "- 如果用户没有给地点, 先追问地点, 不要默认城市.\n"
            + "- 如果用户没有给日期, 先追问日期; 用户说\"今天\"或\"明天\"可以直接作为 date 参数传给工具.\n"
            + "- 如果用户没有给待办标题, 先追问标题.\n"
            + "- 不要编造实时信息, 最终回答必须基于工具返回的数据.\n"
            + "\n"
            + "## 待办说明\n"
            + "- 待办数据持久化到数据库, remindAt 会写入提醒计划表, 到时间后通过站内通知(IN_APP)推送提醒.\n"
            + "- 站内通知是当前唯一已接通的通知渠道. 外部渠道(钉钉/企微/邮件/SMS)尚未接入, 后续由用户自行选择.\n"
            + "- 回复时可提及提醒将通过站内通知推送, 后续可在消息中心配置更多通知渠道.\n"
            + "- dueDate 表示截止日期, remindAt 表示提醒触发时间, visibility 控制可见范围(private/team/org).\n"
            + "- 最终回复中应包含待办标题、提醒时间和当前时间, 让用户确认信息已准确记录.\n"
            + "- 创建待办时不需要先调用 system.time.now. todo.create 返回结果中已包含 createdAt 和 remindAt, 直接用于最终回复即可.\n"
            + "\n"
            + "## 待办确认->创建完整示例\n"
            + "用户: 创建待办, 5分钟后提醒我带伞\n"
            + "\n"
            + "你的回复:\n"
            + "THOUGHT: 用户要创建待办带伞, 5分钟后提醒. 先向用户确认信息.\n"
            + "CONFIRM_NEEDED: 创建待办带伞, 5分钟后通过站内通知提醒 | LOW | {\"title\":\"带伞\",\"remindAt\":\"5分钟后\",\"visibility\":\"private\"}\n"
            + "\n"
            + "用户确认后, 你的回复:\n"
            + "THOUGHT: 用户已确认, 执行创建.\n"
            + "ACTION: todo.create | {\"title\":\"带伞\",\"remindAt\":\"5分钟后\",\"visibility\":\"private\"}\n"
            + "\n"
            + "OBSERVATION 返回后, 你的回复:\n"
            + "THOUGHT: 待办创建成功, 告知用户.\n"
            + "FINAL_ANSWER: 已为您创建待办带伞, 将在今天 12:34 通过站内通知提醒(当前时间 12:29). 后续可在消息中心配置钉钉、企微等更多通知渠道.\n";
    }

    @Override
    public List<ToolDef> availableTools() {
        return List.of(
            new ToolDef("system.time.now", "查询服务器当前日期、星期和时间",
                RiskLevel.LOW,
                Map.of("timezone", "string: IANA 时区, 默认 Asia/Shanghai")),
            new ToolDef("weather.lookup", "查询指定日期、指定城市的天气概况",
                RiskLevel.LOW,
                Map.of(
                    "location", "string: 城市或地点, 例如 上海、北京、深圳, 必填",
                    "date", "string: 查询日期, 支持 yyyy-MM-dd、today、tomorrow、今天、明天, 必填"
                )),
            new ToolDef("todo.create", "创建一条个人待办, 预留日历日期、提醒时间和 RBAC 可见范围",
                RiskLevel.LOW,
                Map.of(
                    "title", "string: 待办标题, 必填",
                    "dueDate", "string: 截止日期, 支持绝对时间(yyyy-MM-dd HH:mm:ss)和相对时间(5分钟后/1小时后/明天/后天), 可选",
                    "remindAt", "string: 提醒时间, 格式同 dueDate, 支持绝对和相对时间, 可选",
                    "visibility", "string: private/team/org, 默认 private",
                    "assignee", "string: 负责人, 默认 current-user"
                )),
            new ToolDef("todo.list", "查看当前用户待办列表",
                RiskLevel.LOW,
                Map.of("assignee", "string: 负责人, 默认 current-user", "status", "string: open/done/all, 默认 open"))
        );
    }
}
