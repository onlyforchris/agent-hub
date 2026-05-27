import React, { useState } from "react";
import { 
  BarChart3, Brain, ChevronRight, ClipboardCheck, Database, FileText, Home, LayoutDashboard, Lock, MessageSquare, RefreshCcw, Search, Settings, ShieldCheck, Zap, Cpu, Bell, HardDrive, Users, Key, Shield, Plus, Check, Activity, ShieldAlert, Box, TerminalSquare, Waypoints, FileUp, Workflow, Webhook, FileSpreadsheet, Download, MessageSquareDot, Smartphone, Mail, Bot, Network, Braces, SlidersHorizontal, ToggleLeft, KeyRound, UsersRound, Wrench, AlignLeft, FolderLock, ToggleRight, Lightbulb, Palette, Settings2, ArrowRight, Server, Layers, Blocks, ArrowDown, PlayCircle, GitBranch, BrainCircuit, SearchCode, CheckCircle2, FileOutput, Info, AlertTriangle, UploadCloud, X
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell } from "recharts";
import { cn } from "@/src/lib/utils.ts";

export function NotificationsView() {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="h-full flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
       <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
        <div>
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
             <Bell className="w-4 h-4 text-blue-600" />
             消息订阅与多点推送
          </h3>
          <p className="text-xs text-slate-500 mt-1">对归因完成、证据不足和人工复核状态，通过内网协作工具推达责任人。</p>
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-slate-50/30 p-6">
         <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-6 max-w-3xl">
            <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-4 mb-4">异常事件推送策略设置</h4>
            <div className="space-y-6">
               <div className="flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded bg-blue-50 flex justify-center items-center shrink-0">
                      <MessageSquareDot className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h5 className="font-bold text-slate-700">系统应用内站内信</h5>
                      <p className="text-xs text-slate-500 mt-0.5">当 Agent 分析完成但需要人工二次确认（Low Confidence）时推送红点提示。</p>
                    </div>
                  </div>
                  <div className="w-10 h-5 bg-blue-600 rounded-full flex items-center p-1 cursor-pointer">
                    <div className="w-3 h-3 bg-white rounded-full translate-x-5 shadow-sm" />
                  </div>
               </div>
               
               <div className="flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded bg-indigo-50 flex justify-center items-center shrink-0">
                      <Smartphone className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <h5 className="font-bold text-slate-700">钉钉工作通知对接</h5>
                      <p className="text-xs text-slate-500 mt-0.5">每日/每周汇总已确认归因、需复核差异和责任系统分布，并同步发送至业财融合项目组群聊。</p>
                    </div>
                  </div>
                  <div className="w-10 h-5 bg-blue-600 rounded-full flex items-center p-1 cursor-pointer">
                    <div className="w-3 h-3 bg-white rounded-full translate-x-5 shadow-sm" />
                  </div>
               </div>

               <div className="flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded bg-slate-100 flex justify-center items-center shrink-0">
                      <Mail className="w-5 h-5 text-slate-600" />
                    </div>
                    <div>
                      <h5 className="font-bold text-slate-700">企业级电子邮箱</h5>
                      <p className="text-xs text-slate-500 mt-0.5">当出现千万元级单据金额异动，触发最高危告警给关联的财务总监主管。</p>
                    </div>
                  </div>
                  <div className="w-10 h-5 bg-blue-600 rounded-full flex items-center p-1 cursor-pointer">
                    <div className="w-3 h-3 bg-white rounded-full translate-x-5 shadow-sm" />
                  </div>
               </div>
            </div>
         </div>

         <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl relative overflow-hidden max-w-3xl">
           <div className="relative z-10">
             <h4 className="font-bold text-white mb-2 flex items-center gap-2"><RefreshCcw className="w-4 h-4 text-emerald-400" /> 执行运作闭环</h4>
             <p className="text-sm text-slate-400 leading-relaxed max-w-xl mb-6">平台采用“差异接入 → 规则归因 → 模型报告 → 人工复核 → 责任系统跟进”的闭环模式，保留人工确认和系统责任边界。</p>
             
             <div className="flex items-center gap-3">
               <div className="bg-slate-800 text-slate-300 text-xs px-3 py-2 rounded shadow-inner font-mono font-medium">1. 帆软差异接入</div>
               <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
               <div className="bg-slate-800 text-slate-300 text-xs px-3 py-2 rounded shadow-inner font-mono font-medium border border-blue-500/30 text-blue-300">2. 规则计算与归因</div>
               <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
               <div className="bg-slate-800 text-slate-300 text-xs px-3 py-2 rounded shadow-inner font-mono font-medium">3. 钉钉/邮件提醒</div>
               <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
               <div className="bg-slate-800 text-slate-300 text-xs px-3 py-2 rounded shadow-inner font-mono font-medium border border-emerald-500/30 text-emerald-300">4. 人工复核与案例沉淀</div>
             </div>
           </div>
         </div>
      </div>
    </motion.div>
  );
}

