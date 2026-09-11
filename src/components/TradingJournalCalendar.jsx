import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  Search,
  Trash2,
  Pencil,
  Moon,
  Sun,
  Target,
  NotebookPen,
  ImagePlus,
  Upload,
  Flame,
  Trophy,
  Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const STORAGE_KEY = "trading-journal-pro-v2";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const strategies = ["London breakout", "NY reversal", "Liquidity sweep", "Trend continuation", "Scalp", "Range fade"];

const defaultForm = (date = new Date().toISOString().slice(0, 10)) => ({
  id: "",
  date,
  pair: "",
  direction: "buy",
  entry: "",
  exit: "",
  lotSize: "",
  riskPercent: "",
  pnl: "",
  strategy: "",
  session: "london",
  confidence: "3",
  grade: "A",
  screenshot: "",
  note: "",
});

function formatMoney(value) {
  const n = Number(value || 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

function cls(...parts) {
  return parts.filter(Boolean).join(" ");
}

function getMonthGrid(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();
  const cells = [];

  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month - 1, prevMonthDays - i), currentMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ date: new Date(year, month, day), currentMonth: true });
  }
  while (cells.length < 42) {
    const nextDay = cells.length - (firstDay + daysInMonth) + 1;
    cells.push({ date: new Date(year, month + 1, nextDay), currentMonth: false });
  }
  return cells;
}

function getHeatLevel(dayPnl) {
  if (dayPnl >= 300) return "strong-green";
  if (dayPnl > 0) return "green";
  if (dayPnl <= -300) return "strong-red";
  if (dayPnl < 0) return "red";
  return "neutral";
}

function getCurrentStreak(trades) {
  const sorted = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));
  const daily = new Map();
  for (const t of sorted) {
    daily.set(t.date, (daily.get(t.date) || 0) + Number(t.pnl || 0));
  }
  const days = [...daily.entries()].sort((a, b) => new Date(a[0]) - new Date(b[0]));
  let streak = 0;
  let type = null;
  for (let i = days.length - 1; i >= 0; i--) {
    const pnl = days[i][1];
    const currentType = pnl >= 0 ? "win" : "loss";
    if (!type) type = currentType;
    if (currentType === type) streak += 1;
    else break;
  }
  return { streak, type };
}

function Sparkline({ points, positive = true }) {
  if (!points.length) return <div className="h-24 w-full rounded-2xl border border-dashed border-white/10" />;
  const width = 520;
  const height = 110;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const path = points
    .map((p, i) => {
      const x = (i / Math.max(points.length - 1, 1)) * (width - 16) + 8;
      const y = height - ((p - min) / range) * (height - 16) - 8;
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-28 w-full overflow-visible">
      <defs>
        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={positive ? "rgba(74,222,128,0.35)" : "rgba(251,113,133,0.35)"} />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      <path d={path} fill="none" stroke={positive ? "#4ade80" : "#fb7185"} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export default function TradingJournalCalendar() {
  const fileInputRef = useRef(null);
  const [dark, setDark] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(defaultForm());
  const [trades, setTrades] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw
        ? JSON.parse(raw)
        : [
            {
              id: crypto.randomUUID(),
              date: new Date().toISOString().slice(0, 10),
              pair: "XAUUSD",
              direction: "buy",
              entry: "2335.40",
              exit: "2342.10",
              lotSize: "0.50",
              riskPercent: "1",
              pnl: "185.40",
              strategy: "London breakout",
              session: "london",
              confidence: "4",
              grade: "A",
              screenshot: "",
              note: "Clean structure break with confirmation candle.",
            },
            {
              id: crypto.randomUUID(),
              date: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
              pair: "GBPUSD",
              direction: "sell",
              entry: "1.2840",
              exit: "1.2816",
              lotSize: "1.00",
              riskPercent: "1",
              pnl: "240.00",
              strategy: "Liquidity sweep",
              session: "new-york",
              confidence: "5",
              grade: "A",
              screenshot: "",
              note: "Took sell after sweep and displacement.",
            },
            {
              id: crypto.randomUUID(),
              date: new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10),
              pair: "NAS100",
              direction: "buy",
              entry: "18240",
              exit: "18188",
              lotSize: "0.20",
              riskPercent: "1",
              pnl: "-92.00",
              strategy: "Trend continuation",
              session: "london",
              confidence: "2",
              grade: "C",
              screenshot: "",
              note: "Entered too early before reclaim.",
            },
          ];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
  }, [trades]);

  const filteredTrades = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return trades;
    return trades.filter((t) =>
      [t.pair, t.strategy, t.session, t.direction, t.note, t.grade, t.date]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [trades, search]);

  const stats = useMemo(() => {
    const total = filteredTrades.length;
    const wins = filteredTrades.filter((t) => Number(t.pnl) > 0).length;
    const losses = filteredTrades.filter((t) => Number(t.pnl) < 0).length;
    const pnl = filteredTrades.reduce((sum, t) => sum + Number(t.pnl || 0), 0);
    const avg = total ? pnl / total : 0;
    const winRate = total ? (wins / total) * 100 : 0;
    return { total, wins, losses, pnl, avg, winRate };
  }, [filteredTrades]);

  const byDate = useMemo(() => {
    const map = {};
    for (const trade of trades) {
      map[trade.date] ??= [];
      map[trade.date].push(trade);
    }
    return map;
  }, [trades]);

  const selectedTrades = useMemo(() => {
    return (byDate[selectedDate] || []).sort((a, b) => Number(b.pnl) - Number(a.pnl));
  }, [byDate, selectedDate]);

  const monthCells = useMemo(() => getMonthGrid(currentMonth), [currentMonth]);

  const monthlyTrades = useMemo(() => {
    const y = currentMonth.getFullYear();
    const m = currentMonth.getMonth();
    return trades.filter((t) => {
      const d = new Date(t.date);
      return d.getFullYear() === y && d.getMonth() === m;
    });
  }, [trades, currentMonth]);

  const monthlyPnl = monthlyTrades.reduce((sum, t) => sum + Number(t.pnl || 0), 0);

  const equitySeries = useMemo(() => {
    const sorted = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));
    let running = 0;
    return sorted.map((trade) => {
      running += Number(trade.pnl || 0);
      return running;
    });
  }, [trades]);

  const strategyStats = useMemo(() => {
    const map = new Map();
    for (const t of trades) {
      const key = t.strategy || "Uncategorized";
      if (!map.has(key)) map.set(key, { name: key, count: 0, pnl: 0, wins: 0 });
      const item = map.get(key);
      item.count += 1;
      item.pnl += Number(t.pnl || 0);
      if (Number(t.pnl) > 0) item.wins += 1;
    }
    return [...map.values()].sort((a, b) => b.pnl - a.pnl);
  }, [trades]);

  const currentStreak = useMemo(() => getCurrentStreak(trades), [trades]);
  const bestDay = useMemo(() => {
    const entries = Object.entries(byDate).map(([date, dayTrades]) => ({
      date,
      pnl: dayTrades.reduce((sum, t) => sum + Number(t.pnl || 0), 0),
    }));
    return entries.sort((a, b) => b.pnl - a.pnl)[0];
  }, [byDate]);

  function updateForm(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function openNewTrade(date = selectedDate) {
    setForm(defaultForm(date));
    setOpen(true);
  }

  function editTrade(trade) {
    setForm(trade);
    setOpen(true);
  }

  function saveTrade() {
    if (!form.date || !form.pair || form.pnl === "") return;
    const payload = {
      ...form,
      id: form.id || crypto.randomUUID(),
      pair: form.pair.toUpperCase(),
    };
    setTrades((prev) => {
      const exists = prev.some((t) => t.id === payload.id);
      return exists ? prev.map((t) => (t.id === payload.id ? payload : t)) : [payload, ...prev];
    });
    setSelectedDate(payload.date);
    setOpen(false);
    setForm(defaultForm(payload.date));
  }

  function deleteTrade(id) {
    setTrades((prev) => prev.filter((t) => t.id !== id));
  }

  function handleScreenshotUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateForm("screenshot", String(reader.result));
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className={cls("min-h-screen w-full transition-colors", dark ? "bg-[#070a12] text-white" : "bg-slate-50 text-slate-900")}>
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className={cls(
            "mb-6 overflow-hidden rounded-[28px] border p-6 shadow-2xl",
            dark
              ? "border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.18),transparent_25%),radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_25%),linear-gradient(135deg,#0d1220,#121a31,#18152f)]"
              : "border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100"
          )}
        >
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium tracking-wide text-emerald-300">
                <Flame className="h-4 w-4" />
                Prop-Firm Style Journal
              </div>
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Trade review with a funded-dashboard feel.</h1>
              <p className={cls("mt-2 max-w-2xl text-sm md:text-base", dark ? "text-slate-300" : "text-slate-600")}>
                Log every setup, track your equity, review strategy performance, and build a visual heatmap of your trading discipline.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className={cls("flex items-center gap-2 rounded-2xl border px-3 py-2", dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white")}>
                <Search className="h-4 w-4 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search pair, strategy, note..."
                  className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                />
              </div>
              <Button onClick={() => setDark((v) => !v)} variant="outline" className="rounded-2xl">
                {dark ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                {dark ? "Light" : "Dark"}
              </Button>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => openNewTrade()} className="rounded-2xl px-5">
                    <Plus className="mr-2 h-4 w-4" /> Add Trade
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
                  <DialogHeader>
                    <DialogTitle>{form.id ? "Edit Trade" : "New Trade Entry"}</DialogTitle>
                  </DialogHeader>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <Label>Date</Label>
                      <Input type="date" value={form.date} onChange={(e) => updateForm("date", e.target.value)} />
                    </div>
                    <div>
                      <Label>Pair / Symbol</Label>
                      <Input placeholder="XAUUSD" value={form.pair} onChange={(e) => updateForm("pair", e.target.value)} />
                    </div>
                    <div>
                      <Label>Direction</Label>
                      <Select value={form.direction} onValueChange={(v) => updateForm("direction", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="buy">Buy</SelectItem>
                          <SelectItem value="sell">Sell</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Session</Label>
                      <Select value={form.session} onValueChange={(v) => updateForm("session", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="asia">Asia</SelectItem>
                          <SelectItem value="london">London</SelectItem>
                          <SelectItem value="new-york">New York</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Entry Price</Label>
                      <Input value={form.entry} onChange={(e) => updateForm("entry", e.target.value)} />
                    </div>
                    <div>
                      <Label>Exit Price</Label>
                      <Input value={form.exit} onChange={(e) => updateForm("exit", e.target.value)} />
                    </div>
                    <div>
                      <Label>Lot Size</Label>
                      <Input value={form.lotSize} onChange={(e) => updateForm("lotSize", e.target.value)} />
                    </div>
                    <div>
                      <Label>Risk %</Label>
                      <Input value={form.riskPercent} onChange={(e) => updateForm("riskPercent", e.target.value)} placeholder="1" />
                    </div>
                    <div>
                      <Label>Profit / Loss ($)</Label>
                      <Input value={form.pnl} onChange={(e) => updateForm("pnl", e.target.value)} placeholder="120.50 or -45" />
                    </div>
                    <div>
                      <Label>Strategy</Label>
                      <Select value={form.strategy || undefined} onValueChange={(v) => updateForm("strategy", v)}>
                        <SelectTrigger><SelectValue placeholder="Select strategy" /></SelectTrigger>
                        <SelectContent>
                          {strategies.map((strategy) => (
                            <SelectItem key={strategy} value={strategy}>{strategy}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Confidence (1-5)</Label>
                      <Select value={form.confidence} onValueChange={(v) => updateForm("confidence", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["1", "2", "3", "4", "5"].map((v) => (
                            <SelectItem key={v} value={v}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Trade Grade</Label>
                      <Select value={form.grade} onValueChange={(v) => updateForm("grade", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["A", "B", "C", "D"].map((v) => (
                            <SelectItem key={v} value={v}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-2">
                      <Label>Screenshot</Label>
                      <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center">
                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleScreenshotUpload} />
                        <Button type="button" variant="outline" className="rounded-2xl" onClick={() => fileInputRef.current?.click()}>
                          <Upload className="mr-2 h-4 w-4" /> Upload Screenshot
                        </Button>
                        {form.screenshot && <Badge variant="secondary">Image attached</Badge>}
                      </div>
                      {form.screenshot && (
                        <div className="mt-3 overflow-hidden rounded-2xl border border-white/10">
                          <img src={form.screenshot} alt="Trade screenshot" className="h-48 w-full object-cover" />
                        </div>
                      )}
                    </div>
                    <div className="md:col-span-2">
                      <Label>Notes</Label>
                      <Textarea rows={5} value={form.note} onChange={(e) => updateForm("note", e.target.value)} placeholder="What did you see? What would you improve next time?" />
                    </div>
                  </div>
                  <div className="mt-5 flex justify-end gap-3">
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={saveTrade}>Save Trade</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </motion.div>

        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
          {[
            { title: "Total PnL", value: formatMoney(stats.pnl), icon: DollarSign, tone: stats.pnl >= 0 ? "text-emerald-400" : "text-rose-400" },
            { title: "Win Rate", value: `${stats.winRate.toFixed(0)}%`, icon: Target, tone: "text-blue-400" },
            { title: "Trades", value: stats.total, icon: BarChart3, tone: "text-violet-400" },
            { title: "Streak", value: `${currentStreak.streak || 0} ${currentStreak.type || "days"}`, icon: Trophy, tone: currentStreak.type === "win" ? "text-emerald-400" : "text-rose-400" },
            { title: "Best Day", value: bestDay ? formatMoney(bestDay.pnl) : "$0.00", icon: Activity, tone: "text-amber-400" },
          ].map((item) => (
            <Card key={item.title} className={cls("rounded-3xl border shadow-xl", dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white")}>
              <CardContent className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className={cls("text-xs", dark ? "text-slate-400" : "text-slate-500")}>{item.title}</span>
                  <item.icon className={cls("h-4 w-4", item.tone)} />
                </div>
                <div className={cls("text-xl font-semibold", item.tone)}>{item.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-6">
            <Card className={cls("rounded-3xl border shadow-xl", dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white")}>
              <CardHeader>
                <CardTitle className="text-base">Calendar Heatmap</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ["bg-emerald-500/15 border-emerald-500/30", "Green day"],
                    ["bg-emerald-500/30 border-emerald-500/40", "Strong green"],
                    ["bg-rose-500/15 border-rose-500/30", "Red day"],
                    ["bg-rose-500/30 border-rose-500/40", "Strong red"],
                  ].map(([style, label]) => (
                    <div key={label} className="flex items-center gap-2 rounded-2xl border border-white/10 p-2">
                      <div className={cls("h-4 w-4 rounded-md border", style)} />
                      <span className={cls(dark ? "text-slate-300" : "text-slate-600")}>{label}</span>
                    </div>
                  ))}
                </div>
                <p className={cls(dark ? "text-slate-400" : "text-slate-500")}>
                  Bigger profits create a stronger heatmap tint, so you can spot your best and worst days instantly.
                </p>
              </CardContent>
            </Card>

            <Card className={cls("rounded-3xl border shadow-xl", dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white")}>
              <CardHeader>
                <CardTitle className="text-base">This Month</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                  <div>
                    <div className="text-xs text-slate-400">Monthly PnL</div>
                    <div className={cls("text-2xl font-bold", monthlyPnl >= 0 ? "text-emerald-400" : "text-rose-400")}>{formatMoney(monthlyPnl)}</div>
                  </div>
                  {monthlyPnl >= 0 ? <TrendingUp className="h-6 w-6 text-emerald-400" /> : <TrendingDown className="h-6 w-6 text-rose-400" />}
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className={cls("rounded-2xl p-3", dark ? "bg-white/5" : "bg-slate-50")}>
                    <div className="text-xs text-slate-400">Wins</div>
                    <div className="mt-1 text-lg font-semibold text-emerald-400">{stats.wins}</div>
                  </div>
                  <div className={cls("rounded-2xl p-3", dark ? "bg-white/5" : "bg-slate-50")}>
                    <div className="text-xs text-slate-400">Losses</div>
                    <div className="mt-1 text-lg font-semibold text-rose-400">{stats.losses}</div>
                  </div>
                  <div className={cls("rounded-2xl p-3", dark ? "bg-white/5" : "bg-slate-50")}>
                    <div className="text-xs text-slate-400">Avg Trade</div>
                    <div className="mt-1 text-lg font-semibold">{formatMoney(stats.avg)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={cls("rounded-3xl border shadow-xl", dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white")}>
              <CardHeader>
                <CardTitle className="text-base">Quick Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className={cls("space-y-3 text-sm", dark ? "text-slate-300" : "text-slate-600")}>
                  <li>• Click any day to review all trades.</li>
                  <li>• Upload chart screenshots for post-analysis.</li>
                  <li>• Strategy table helps you spot what is really paying you.</li>
                  <li>• Equity curve shows whether your execution is becoming more consistent.</li>
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className={cls("rounded-3xl border shadow-xl", dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white")}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg">{MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" className="rounded-2xl" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" className="rounded-2xl" onClick={() => setCurrentMonth(new Date())}>Today</Button>
                  <Button variant="outline" size="icon" className="rounded-2xl" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-3 grid grid-cols-7 gap-2 text-center text-xs font-medium text-slate-400">
                  {DAYS.map((day) => <div key={day} className="py-2">{day}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {monthCells.map(({ date, currentMonth: inMonth }) => {
                    const iso = date.toISOString().slice(0, 10);
                    const dayTrades = byDate[iso] || [];
                    const dayPnl = dayTrades.reduce((sum, t) => sum + Number(t.pnl || 0), 0);
                    const isSelected = selectedDate === iso;
                    const isToday = iso === new Date().toISOString().slice(0, 10);
                    const level = getHeatLevel(dayPnl);
                    const heatStyle = {
                      "strong-green": "bg-emerald-500/30 border-emerald-500/35",
                      green: "bg-emerald-500/15 border-emerald-500/25",
                      "strong-red": "bg-rose-500/30 border-rose-500/35",
                      red: "bg-rose-500/15 border-rose-500/25",
                      neutral: dark ? "bg-white/[0.04] border-white/10" : "bg-slate-50 border-slate-200",
                    }[level];

                    return (
                      <motion.button
                        whileHover={{ y: -2 }}
                        key={iso}
                        onClick={() => setSelectedDate(iso)}
                        className={cls(
                          "min-h-[110px] rounded-2xl border p-3 text-left transition",
                          heatStyle,
                          !inMonth && "opacity-40",
                          isSelected && "ring-2 ring-blue-500",
                          dark ? "hover:bg-white/[0.08]" : "hover:bg-slate-100"
                        )}
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <span className={cls("text-sm font-semibold", isToday && "text-blue-400")}>{date.getDate()}</span>
                          {dayTrades.length > 0 && <Badge variant="secondary" className="rounded-full">{dayTrades.length}</Badge>}
                        </div>
                        {dayTrades.length > 0 ? (
                          <div className="space-y-2">
                            <div className={cls(
                              "rounded-xl px-2 py-1 text-xs font-medium",
                              dayPnl >= 0 ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
                            )}>
                              {dayPnl >= 0 ? "+" : ""}{formatMoney(dayPnl)}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {dayTrades.slice(0, 2).map((trade) => (
                                <span key={trade.id} className={cls(
                                  "rounded-full px-2 py-0.5 text-[10px]",
                                  trade.direction === "buy" ? "bg-blue-500/15 text-blue-300" : "bg-amber-500/15 text-amber-300"
                                )}>
                                  {trade.pair}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="pt-4 text-xs text-slate-400">No trades</div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card className={cls("rounded-3xl border shadow-xl", dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white")}>
                <CardHeader>
                  <CardTitle className="text-lg">Equity Curve</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 flex items-end justify-between">
                    <div>
                      <div className="text-xs text-slate-400">Running Equity</div>
                      <div className={cls("text-2xl font-bold", stats.pnl >= 0 ? "text-emerald-400" : "text-rose-400")}>{formatMoney(stats.pnl)}</div>
                    </div>
                    <Badge variant="secondary">{equitySeries.length} points</Badge>
                  </div>
                  <Sparkline points={equitySeries} positive={stats.pnl >= 0} />
                </CardContent>
              </Card>

              <Card className={cls("rounded-3xl border shadow-xl", dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white")}>
                <CardHeader>
                  <CardTitle className="text-lg">Strategy Analytics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {strategyStats.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-400">No strategy data yet.</div>
                  ) : strategyStats.slice(0, 5).map((item) => {
                    const rate = item.count ? (item.wins / item.count) * 100 : 0;
                    return (
                      <div key={item.name} className={cls("rounded-2xl border p-3", dark ? "border-white/10 bg-white/[0.03]" : "border-slate-200 bg-slate-50")}>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div>
                            <div className="font-medium">{item.name}</div>
                            <div className="text-xs text-slate-400">{item.count} trades</div>
                          </div>
                          <div className={cls("text-sm font-semibold", item.pnl >= 0 ? "text-emerald-400" : "text-rose-400")}>{formatMoney(item.pnl)}</div>
                        </div>
                        <div className="mb-2 h-2 rounded-full bg-white/10">
                          <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${Math.max(rate, 6)}%` }} />
                        </div>
                        <div className="text-xs text-slate-400">Win rate {rate.toFixed(0)}%</div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>

            <Card className={cls("rounded-3xl border shadow-xl", dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white")}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-lg">Trades on {selectedDate}</CardTitle>
                <Button onClick={() => openNewTrade(selectedDate)} className="rounded-2xl">
                  <Plus className="mr-2 h-4 w-4" /> Add for this day
                </Button>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="cards" className="w-full">
                  <TabsList className="mb-4 rounded-2xl">
                    <TabsTrigger value="cards">Cards</TabsTrigger>
                    <TabsTrigger value="summary">Summary</TabsTrigger>
                  </TabsList>
                  <TabsContent value="cards">
                    <div className="space-y-4">
                      {selectedTrades.length === 0 ? (
                        <div className={cls("rounded-2xl border border-dashed p-8 text-center text-sm", dark ? "border-white/10 text-slate-400" : "border-slate-200 text-slate-500")}>
                          No trades recorded for this day yet.
                        </div>
                      ) : selectedTrades.map((trade) => (
                        <div key={trade.id} className={cls("rounded-3xl border p-4", dark ? "border-white/10 bg-white/[0.03]" : "border-slate-200 bg-slate-50")}>
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-lg font-semibold">{trade.pair}</h3>
                                <Badge className={cls(trade.direction === "buy" ? "bg-blue-500/15 text-blue-300 hover:bg-blue-500/15" : "bg-amber-500/15 text-amber-300 hover:bg-amber-500/15")}>
                                  {trade.direction.toUpperCase()}
                                </Badge>
                                <Badge variant="secondary">{trade.session}</Badge>
                                <Badge variant="secondary">Grade {trade.grade}</Badge>
                              </div>
                              <p className={cls("mt-2 text-sm", dark ? "text-slate-300" : "text-slate-600")}>{trade.strategy || "No strategy tagged"}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className={cls("rounded-2xl px-4 py-2 text-sm font-semibold", Number(trade.pnl) >= 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400")}>
                                {Number(trade.pnl) >= 0 ? "+" : ""}{formatMoney(trade.pnl)}
                              </div>
                              <Button variant="outline" size="icon" className="rounded-2xl" onClick={() => editTrade(trade)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="outline" size="icon" className="rounded-2xl" onClick={() => deleteTrade(trade.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
                            <div className={cls("rounded-2xl p-3 text-sm", dark ? "bg-white/5" : "bg-white")}>
                              <div className="text-xs text-slate-400">Entry</div>
                              <div className="mt-1 font-medium">{trade.entry || "-"}</div>
                            </div>
                            <div className={cls("rounded-2xl p-3 text-sm", dark ? "bg-white/5" : "bg-white")}>
                              <div className="text-xs text-slate-400">Exit</div>
                              <div className="mt-1 font-medium">{trade.exit || "-"}</div>
                            </div>
                            <div className={cls("rounded-2xl p-3 text-sm", dark ? "bg-white/5" : "bg-white")}>
                              <div className="text-xs text-slate-400">Lot</div>
                              <div className="mt-1 font-medium">{trade.lotSize || "-"}</div>
                            </div>
                            <div className={cls("rounded-2xl p-3 text-sm", dark ? "bg-white/5" : "bg-white")}>
                              <div className="text-xs text-slate-400">Risk %</div>
                              <div className="mt-1 font-medium">{trade.riskPercent || "-"}</div>
                            </div>
                            <div className={cls("rounded-2xl p-3 text-sm", dark ? "bg-white/5" : "bg-white")}>
                              <div className="text-xs text-slate-400">Confidence</div>
                              <div className="mt-1 font-medium">{trade.confidence}/5</div>
                            </div>
                          </div>
                          {trade.screenshot && (
                            <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
                              <img src={trade.screenshot} alt="Trade screenshot" className="h-64 w-full object-cover" />
                            </div>
                          )}
                          {trade.note && (
                            <div className={cls("mt-4 rounded-2xl p-4 text-sm", dark ? "bg-white/5 text-slate-300" : "bg-white text-slate-600")}>
                              {trade.note}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                  <TabsContent value="summary">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                      <Card className={cls(dark ? "border-white/10 bg-white/[0.03]" : "border-slate-200 bg-slate-50")}>
                        <CardContent className="p-5">
                          <div className="text-xs text-slate-400">Day Total</div>
                          <div className={cls("mt-2 text-2xl font-bold", selectedTrades.reduce((sum, t) => sum + Number(t.pnl || 0), 0) >= 0 ? "text-emerald-400" : "text-rose-400")}>
                            {formatMoney(selectedTrades.reduce((sum, t) => sum + Number(t.pnl || 0), 0))}
                          </div>
                        </CardContent>
                      </Card>
                      <Card className={cls(dark ? "border-white/10 bg-white/[0.03]" : "border-slate-200 bg-slate-50")}>
                        <CardContent className="p-5">
                          <div className="text-xs text-slate-400">Setups Taken</div>
                          <div className="mt-2 text-2xl font-bold">{selectedTrades.length}</div>
                        </CardContent>
                      </Card>
                      <Card className={cls(dark ? "border-white/10 bg-white/[0.03]" : "border-slate-200 bg-slate-50")}>
                        <CardContent className="p-5">
                          <div className="text-xs text-slate-400">Best Pair</div>
                          <div className="mt-2 text-2xl font-bold">{selectedTrades[0]?.pair || "-"}</div>
                        </CardContent>
                      </Card>
                      <Card className={cls(dark ? "border-white/10 bg-white/[0.03]" : "border-slate-200 bg-slate-50")}>
                        <CardContent className="p-5">
                          <div className="text-xs text-slate-400">Images</div>
                          <div className="mt-2 flex items-center gap-2 text-2xl font-bold">
                            <ImagePlus className="h-5 w-5 text-blue-400" />
                            {selectedTrades.filter((t) => t.screenshot).length}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
