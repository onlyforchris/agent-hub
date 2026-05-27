import React, { useState } from "react";
import { 
  BarChart3, Brain, ChevronRight, ClipboardCheck, Database, FileText, Home, LayoutDashboard, Lock, MessageSquare, RefreshCcw, Search, Settings, ShieldCheck, Zap, Cpu, Bell, HardDrive, Users, Key, Shield, Plus, Check, Activity, ShieldAlert, Box, TerminalSquare, Waypoints, FileUp, Workflow, Webhook, FileSpreadsheet, Download, MessageSquareDot, Smartphone, Mail, Bot, Network, Braces, SlidersHorizontal, ToggleLeft, KeyRound, UsersRound, Wrench, AlignLeft, FolderLock, ToggleRight, Lightbulb, Palette, Settings2, ArrowRight, Server, Layers, Blocks, ArrowDown, PlayCircle, GitBranch, BrainCircuit, SearchCode, CheckCircle2, FileOutput, Info, AlertTriangle, UploadCloud, X
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell } from "recharts";
import { cn } from "@/src/lib/utils.ts";

export function PlaceholderView({ title, desc, icon: Icon }: { title: string; desc: string; icon: any }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-full py-20 gap-6">
      <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center text-slate-400">
        <Icon className="w-10 h-10" />
      </div>
      <div className="text-center">
        <h3 className="text-xl font-bold text-slate-800">{title}</h3>
        <p className="text-slate-400 mt-2 max-w-sm tracking-wide leading-relaxed font-medium">{desc}</p>
      </div>
      <button className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold shadow-xl shadow-slate-200 transition-transform hover:scale-105 active:scale-95">了解详细建设方案</button>
    </motion.div>
  );
}

