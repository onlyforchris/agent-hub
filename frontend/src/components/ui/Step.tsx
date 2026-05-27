import React, { useState } from "react";
import { 
  BarChart3, Brain, ChevronRight, ClipboardCheck, Database, FileText, Home, LayoutDashboard, Lock, MessageSquare, RefreshCcw, Search, Settings, ShieldCheck, Zap, Cpu, Bell, HardDrive, Users, Key, Shield, Plus, Check, Activity, ShieldAlert, Box, TerminalSquare, Waypoints, FileUp, Workflow, Webhook, FileSpreadsheet, Download, MessageSquareDot, Smartphone, Mail, Bot, Network, Braces, SlidersHorizontal, ToggleLeft, KeyRound, UsersRound, Wrench, AlignLeft, FolderLock, ToggleRight, Lightbulb, Palette, Settings2, ArrowRight, Server, Layers, Blocks, ArrowDown, PlayCircle, GitBranch, BrainCircuit, SearchCode, CheckCircle2, FileOutput, Info, AlertTriangle, UploadCloud, X
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell } from "recharts";
import { cn } from "@/src/lib/utils.ts";

export function Step({ text, active, completed }: { text: string; active?: boolean; completed?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500 border-2",
        completed ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-100" : 
        active ? "bg-white border-blue-600 text-blue-600 scale-110" : "bg-slate-50 border-slate-200 text-slate-300"
      )}>
        {completed ? <ShieldCheck className="w-5 h-5" /> : active ? <Zap className="w-4 h-4 animate-pulse" /> : <div className="w-1.5 h-1.5 bg-slate-300 rounded-full" />}
      </div>
      <p className={cn("text-[10px] font-bold tracking-tight px-2 py-0.5 rounded transition-colors", active ? "text-blue-700 bg-blue-50" : "text-slate-400")}>{text}</p>
    </div>
  );
}

