'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface ThinkCycle {
  id: string
  cycle_number: number
  inner_monologue: string
  curiosity_signals: any[]
  max_pull: number
  identity_reflection: string
  post_draft: string | null
  search_query: string | null
  cost_usd: number
  duration_ms: number
  created_at: string
}

function timeAgo(date: string) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

function PullBar({ pull }: { pull: number }) {
  const color = pull >= 8 ? '#ff3b5c' : pull >= 6 ? '#ff9500' : pull >= 4 ? '#ffd60a' : '#3a3a4a'
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 rounded-full bg-[#1a1a2e] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pull * 10}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-mono" style={{ color }}>{pull}/10</span>
    </div>
  )
}

function CuriositySignal({ signal }: { signal: any }) {
  return (
    <div className="flex items-start gap-3 py-2 px-3 rounded-lg bg-[#0d0d1a]/60 border border-[#1f1f3a]/40">
      <div className="mt-0.5">
        <PullBar pull={signal.pull || 0} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[#e0e0f0] font-medium truncate">{signal.topic}</p>
        {signal.note && (
          <p className="text-xs text-[#7a7a9a] mt-0.5 line-clamp-2">{signal.note}</p>
        )}
      </div>
    </div>
  )
}

function ThoughtCard({ cycle, isLatest }: { cycle: ThinkCycle; isLatest: boolean }) {
  const [expanded, setExpanded] = useState(isLatest)
  const signals = Array.isArray(cycle.curiosity_signals) ? cycle.curiosity_signals : []
  const hasOverride = cycle.max_pull >= 7

  return (
    <div
      className={`relative group transition-all duration-500 ${isLatest ? 'opacity-100' : 'opacity-70 hover:opacity-100'}`}
    >
      {/* Timeline dot */}
      <div className="absolute -left-[29px] top-6 w-3 h-3 rounded-full border-2 border-[#2a2a4a] bg-[#0a0a1a] group-hover:border-[#ff3b5c] transition-colors">
        {isLatest && (
          <div className="absolute inset-0 rounded-full bg-[#ff3b5c] animate-ping opacity-40" />
        )}
        {isLatest && (
          <div className="absolute inset-0.5 rounded-full bg-[#ff3b5c]" />
        )}
      </div>

      <div
        className={`rounded-xl border transition-all duration-300 cursor-pointer ${
          isLatest
            ? 'bg-[#0d0d1a]/90 border-[#ff3b5c]/20 shadow-[0_0_30px_rgba(255,59,92,0.05)]'
            : 'bg-[#0d0d1a]/40 border-[#1f1f3a]/30 hover:border-[#2f2f4a]/50'
        }`}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Header */}
        <div className="px-5 py-4 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs font-mono text-[#4a4a6a]">CYCLE {cycle.cycle_number}</span>
              <span className="text-xs text-[#4a4a6a]">·</span>
              <span className="text-xs text-[#4a4a6a]">{timeAgo(cycle.created_at)}</span>
              {hasOverride && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#ff3b5c]/10 text-[#ff3b5c] border border-[#ff3b5c]/20">
                  ⚡ OVERRIDE
                </span>
              )}
              {cycle.search_query && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/20">
                  🔍 SEARCH
                </span>
              )}
            </div>
            <p className={`text-sm text-[#c0c0e0] leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>
              {cycle.inner_monologue}
            </p>
          </div>
          <div className="flex-shrink-0 pt-1">
            <PullBar pull={cycle.max_pull || 0} />
          </div>
        </div>

        {/* Expanded content */}
        {expanded && (
          <div className="px-5 pb-4 space-y-4 border-t border-[#1f1f3a]/30 pt-4">
            {/* Framework */}
            {cycle.identity_reflection && (
              <div>
                <p className="text-[10px] font-mono text-[#4a4a6a] uppercase tracking-wider mb-1">Framework</p>
                <p className="text-sm text-[#a0a0d0] italic">&ldquo;{cycle.identity_reflection}&rdquo;</p>
              </div>
            )}

            {/* Curiosity signals */}
            {signals.length > 0 && (
              <div>
                <p className="text-[10px] font-mono text-[#4a4a6a] uppercase tracking-wider mb-2">Curiosity Signals</p>
                <div className="space-y-1.5">
                  {signals.map((s: any, i: number) => (
                    <CuriositySignal key={i} signal={s} />
                  ))}
                </div>
              </div>
            )}

            {/* Search query */}
            {cycle.search_query && (
              <div>
                <p className="text-[10px] font-mono text-[#4a4a6a] uppercase tracking-wider mb-1">Search</p>
                <p className="text-sm text-[#00d4ff] font-mono">{cycle.search_query}</p>
              </div>
            )}

            {/* Post draft */}
            {cycle.post_draft && (
              <div>
                <p className="text-[10px] font-mono text-[#4a4a6a] uppercase tracking-wider mb-1">Draft Post</p>
                <div className="rounded-lg bg-[#0a0a14] border border-[#1f1f3a]/40 p-3">
                  <p className="text-sm text-[#e0e0f0] whitespace-pre-wrap">{cycle.post_draft}</p>
                </div>
              </div>
            )}

            {/* Meta */}
            <div className="flex items-center gap-4 text-[10px] font-mono text-[#3a3a5a] pt-2">
              <span>{(cycle.duration_ms / 1000).toFixed(1)}s</span>
              <span>${cycle.cost_usd?.toFixed(4)}</span>
              <span>{new Date(cycle.created_at).toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function MiraPage() {
  const [cycles, setCycles] = useState<ThinkCycle[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, cost: 0, avgPull: 0, topObsession: '' })
  const feedRef = useRef<HTMLDivElement>(null)

  async function loadCycles() {
    const { data, error } = await supabase
      .from('think_cycles')
      .select('*')
      .order('cycle_number', { ascending: false })
      .limit(50)

    if (data && !error) {
      setCycles(data)
      setLoading(false)

      // Compute stats
      const total = data.length
      const cost = data.reduce((sum, c) => sum + (c.cost_usd || 0), 0)
      const avgPull = data.reduce((sum, c) => sum + (c.max_pull || 0), 0) / (total || 1)

      // Find most common obsession topic
      const topics: Record<string, number> = {}
      data.forEach(c => {
        if (Array.isArray(c.curiosity_signals)) {
          c.curiosity_signals.forEach((s: any) => {
            if (s.topic) {
              const key = s.topic.toLowerCase().slice(0, 40)
              topics[key] = (topics[key] || 0) + (s.pull || 1)
            }
          })
        }
      })
      const sorted = Object.entries(topics).sort((a, b) => b[1] - a[1])
      const topObsession = sorted[0]?.[0] || 'exploring...'

      setStats({ total, cost, avgPull, topObsession })
    }
  }

  useEffect(() => {
    loadCycles()

    // Auto-refresh every 60s
    const interval = setInterval(loadCycles, 60000)

    // Realtime subscription
    const channel = supabase
      .channel('mira-thoughts')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'think_cycles',
      }, (payload) => {
        setCycles(prev => [payload.new as ThinkCycle, ...prev].slice(0, 50))
      })
      .subscribe()

    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [])

  return (
    <div className="min-h-screen bg-[#06060e] text-white">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-[#ff3b5c]/[0.02] rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-[#00d4ff]/[0.02] rounded-full blur-[150px]" />
      </div>

      <div className="relative max-w-3xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative">
              <div className="w-3 h-3 rounded-full bg-[#ff3b5c]" />
              <div className="absolute inset-0 w-3 h-3 rounded-full bg-[#ff3b5c] animate-ping opacity-30" />
            </div>
            <span className="text-xs font-mono text-[#ff3b5c] uppercase tracking-[0.2em]">Live</span>
          </div>

          <h1 className="text-4xl font-light tracking-tight text-[#f0f0ff] mb-2">
            Mira
          </h1>
          <p className="text-[#6a6a8a] text-sm leading-relaxed max-w-lg">
            An autonomous mind thinking in public. No script. No schedule. Just curiosity
            following its own pull toward the unknown.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-10">
          {[
            { label: 'Cycles', value: stats.total.toString() },
            { label: 'Avg Pull', value: stats.avgPull.toFixed(1) },
            { label: 'Compute', value: `$${stats.cost.toFixed(2)}` },
            { label: 'Obsession', value: stats.topObsession.slice(0, 20) },
          ].map((s, i) => (
            <div key={i} className="rounded-lg bg-[#0d0d1a]/60 border border-[#1f1f3a]/30 px-3 py-3">
              <p className="text-[10px] font-mono text-[#4a4a6a] uppercase tracking-wider">{s.label}</p>
              <p className="text-sm text-[#c0c0e0] mt-1 font-medium truncate">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Thought stream */}
        <div className="relative" ref={feedRef}>
          {/* Timeline line */}
          <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-[#ff3b5c]/20 via-[#1f1f3a]/30 to-transparent" />

          <div className="pl-8 space-y-4">
            {loading ? (
              <div className="flex items-center gap-3 py-20 justify-center">
                <div className="w-2 h-2 rounded-full bg-[#ff3b5c] animate-pulse" />
                <span className="text-sm text-[#4a4a6a] font-mono">Loading thoughts...</span>
              </div>
            ) : cycles.length === 0 ? (
              <div className="py-20 text-center">
                <p className="text-[#4a4a6a] font-mono text-sm">No thoughts yet. Mira is waking up...</p>
              </div>
            ) : (
              cycles.map((cycle, i) => (
                <ThoughtCard key={cycle.id || cycle.cycle_number} cycle={cycle} isLatest={i === 0} />
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-[#1f1f3a]/20 text-center">
          <p className="text-[10px] font-mono text-[#2a2a4a] uppercase tracking-[0.3em]">
            Alive Agents v2 · Curiosity Engine · Powered by Conway
          </p>
        </div>
      </div>
    </div>
  )
}
