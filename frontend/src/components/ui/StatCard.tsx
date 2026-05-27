import React, { useState } from "react";
import { 
  BarChart3, Brain, ChevronRight, ClipboardCheck, Database, FileText, Home, LayoutDashboard, Lock, MessageSquare, RefreshCcw, Search, Settings, ShieldCheck, Zap, Cpu, Bell, HardDrive, Users, Key, Shield, Plus, Check, Activity, ShieldAlert, Box, TerminalSquare, Waypoints, FileUp, Workflow, Webhook, FileSpreadsheet, Download, MessageSquareDot, Smartphone, Mail, Bot, Network, Braces, SlidersHorizontal, ToggleLeft, KeyRound, UsersRound, Wrench, AlignLeft, FolderLock, ToggleRight, Lightbulb, Palette, Settings2, ArrowRight, Server, Layers, Blocks, ArrowDown, PlayCircle, GitBranch, BrainCircuit, SearchCode, CheckCircle2, FileOutput, Info, AlertTriangle, UploadCloud, X
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell } from "recharts";
import { cn } from "@/src/lib/utils.ts";

export function StatCard({ label, value, color }: { label: string; value: string | number; color: "blue" | "green" | "purple" }) {
  const colors = {
    blue: "bg-blue-50/50 text-blue-600 border-blue-200",
    green: "bg-emerald-50/50 text-emerald-600 border-emerald-200",
    purple: "bg-purple-50/50 text-purple-600 border-purple-200",
  };
  return (
    <div className={cn("p-6 rounded-xl border shadow-sm transition-transform hover:scale-[1.02]", colors[color])}>
      <div className="text-xs font-bold flex items-center gap-2">
        <div className={cn("w-2 h-2 rounded-full", color === 'blue' ? 'bg-blue-500' : color === 'green' ? 'bg-emerald-500' : 'bg-purple-500')} />
        {label}
      </div>
      <p className="text-4xl font-bold mt-4 font-mono tracking-tight">{value}</p>
    </div>
  );
}

