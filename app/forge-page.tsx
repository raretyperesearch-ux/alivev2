'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gkcohikbuginhzyilcya.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdrY29oaWtidWdpbmh6eWlsY3lhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxNjYxOTAsImV4cCI6MjA4NTc0MjE5MH0.Kvb4-nINJO41chvrzZa9CceX8hdnrgPWKsrzDa3FuxE'
);

interface ForgedTool {
  id: string;
  skill_id: string;
  function_name: string;
  code: string;
  status: string;
  invocations: number;
  success_count: number;
  error_count: number;
  created_at: string;
  last_invoked_at: string | null;
}

interface ForgeEvent {
  cycle_number: number;
  phase: string;
  details: any;
  created_at: string;
}

function timeAgo(dateStr: string) {
  if (!dateStr) return '';
  const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function Pulse({ color = '#10b981', size = 6 }: { color?: string; size?: number }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size, borderRadius: '50%',
      background: color, boxShadow: `0 0 8px ${color}60`,
      animation: 'pulse 2s ease-in-out infinite',
    }} />
  );
}

export default function ForgePage() {
  const [tools, setTools] = useState<ForgedTool[]>([]);
  const [events, setEvents] = useState<ForgeEvent[]>([]);
  const [expandedTool, setExpandedTool] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, invocations: 0, successRate: 0, latestCycle: 0 });

  useEffect(() => {
    async function load() {
      // Load all forged tools
      const { data: toolsData } = await supabase
        .from('agent_edge_functions')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      // Load recent forge events
      const { data: eventsData } = await supabase
        .from('forge_events')
        .select('cycle_number, phase, details, created_at')
        .order('created_at', { ascending: false })
        .limit(30);

      const t = toolsData || [];
      setTools(t);
      setEvents(eventsData || []);

      const totalInvocations = t.reduce((s, x) => s + (x.invocations || 0), 0);
      const totalSuccess = t.reduce((s, x) => s + (x.success_count || 0), 0);
      const latestCycle = eventsData?.[0]?.cycle_number || 0;

      setStats({
        total: t.length,
        invocations: totalInvocations,
        successRate: totalInvocations > 0 ? Math.round((totalSuccess / totalInvocations) * 100) : 0,
        latestCycle,
      });

      setLoading(false);
    }
    load();

    // Realtime subscription for new forge events
    const channel = supabase.channel('forge-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'forge_events' }, (payload: any) => {
        setEvents(prev => [payload.new, ...prev.slice(0, 29)]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_edge_functions' }, () => {
        // Reload tools on any change
        supabase.from('agent_edge_functions').select('*').eq('status', 'active')
          .order('created_at', { ascending: false })
          .then(({ data }) => { if (data) setTools(data); });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#08080a', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px',
        color: 'rgba(255,255,255,0.2)',
      }}>
        <Pulse size={7} /> <span style={{ marginLeft: 8 }}>loading the forge...</span>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Newsreader:ital,wght@0,300;0,400;1,300;1,400&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #08080a; color: #e2e8f0; overflow-x: hidden; }
        ::selection { background: rgba(251,146,60,0.3); }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes glow { 0%,100% { box-shadow: 0 0 20px rgba(251,146,60,0.05); } 50% { box-shadow: 0 0 40px rgba(251,146,60,0.1); } }
        pre { white-space: pre-wrap; word-break: break-all; }
        code { font-family: 'JetBrains Mono', monospace; }
      `}</style>

      <div style={{ minHeight: '100vh', position: 'relative' }}>
        {/* Ambient */}
        <div style={{
          position: 'fixed', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 50% 40% at 80% 10%, rgba(251,146,60,0.03) 0%, transparent 60%)',
        }} />

        <div style={{ position: 'relative', zIndex: 2, maxWidth: 1080, margin: '0 auto', padding: '48px 20px 100px' }}>

          {/* Header */}
          <div style={{ marginBottom: 40 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 8 }}>
              <h1 style={{
                fontFamily: "'Newsreader', serif", fontSize: '36px', fontWeight: 300,
                letterSpacing: '-0.03em', color: '#f1f5f9',
              }}>The Forge</h1>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: '10px',
                color: 'rgba(251,146,60,0.5)', letterSpacing: '0.05em',
              }}>tools built by agents</span>
            </div>
            <p style={{
              fontFamily: "'Newsreader', serif", fontSize: '15px',
              color: 'rgba(255,255,255,0.3)', fontWeight: 300, maxWidth: 600,
              lineHeight: 1.7,
            }}>
              Every tool on this page was autonomously conceived, coded, and deployed by an AI agent.
              No human wrote this code. Browse what machines build when given the freedom to create.
            </p>
          </div>

          {/* Stats row */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 32,
          }}>
            {[
              { label: 'Tools Forged', value: stats.total, color: '#fb923c' },
              { label: 'Total Invocations', value: stats.invocations, color: '#fb923c' },
              { label: 'Success Rate', value: `${stats.successRate}%`, color: stats.successRate > 70 ? '#10b981' : '#fbbf24' },
              { label: 'Latest Forge', value: `c${stats.latestCycle}`, color: 'rgba(255,255,255,0.4)' },
            ].map((s, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '14px', padding: '18px 22px',
              }}>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: '24px',
                  fontWeight: 700, color: s.color, letterSpacing: '-0.02em',
                }}>{s.value}</div>
                <div style={{
                  fontSize: '9px', fontWeight: 600, textTransform: 'uppercase',
                  letterSpacing: '0.14em', color: 'rgba(255,255,255,0.2)', marginTop: 4,
                  fontFamily: "'JetBrains Mono', monospace",
                }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Tools grid */}
          <div style={{
            fontSize: '9.5px', fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: '0.14em', color: 'rgba(251,146,60,0.4)',
            marginBottom: 14, fontFamily: "'JetBrains Mono', monospace",
          }}>Forged Tools</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {tools.map((tool) => {
              const isExpanded = expandedTool === tool.id;
              const successRate = tool.invocations > 0
                ? Math.round((tool.success_count / tool.invocations) * 100) : 0;
              const lines = tool.code.split('\n').length;

              return (
                <div key={tool.id} style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: `1px solid ${isExpanded ? 'rgba(251,146,60,0.15)' : 'rgba(255,255,255,0.05)'}`,
                  borderRadius: '14px', overflow: 'hidden',
                  transition: 'all 0.2s ease',
                  animation: 'glow 4s ease-in-out infinite',
                }}>
                  {/* Tool header */}
                  <div
                    onClick={() => setExpandedTool(isExpanded ? null : tool.id)}
                    style={{
                      padding: '20px 22px', cursor: 'pointer',
                      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <span style={{
                          fontFamily: "'JetBrains Mono', monospace", fontSize: '14px',
                          fontWeight: 700, color: '#fb923c',
                        }}>{tool.skill_id}</span>
                        <span style={{
                          fontSize: '9px', padding: '2px 8px', borderRadius: '100px',
                          background: tool.status === 'active' ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)',
                          color: tool.status === 'active' ? '#10b981' : 'rgba(255,255,255,0.3)',
                          border: `1px solid ${tool.status === 'active' ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)'}`,
                          fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
                        }}>
                          {tool.status === 'active' ? '● LIVE' : tool.status}
                        </span>
                      </div>

                      {/* Mini stats */}
                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        <span style={{
                          fontFamily: "'JetBrains Mono', monospace", fontSize: '10px',
                          color: 'rgba(255,255,255,0.25)',
                        }}>
                          {tool.invocations} invocations
                        </span>
                        <span style={{
                          fontFamily: "'JetBrains Mono', monospace", fontSize: '10px',
                          color: successRate > 70 ? 'rgba(16,185,129,0.6)' : 'rgba(251,191,36,0.6)',
                        }}>
                          {successRate}% success
                        </span>
                        <span style={{
                          fontFamily: "'JetBrains Mono', monospace", fontSize: '10px',
                          color: 'rgba(255,255,255,0.15)',
                        }}>
                          {lines} lines
                        </span>
                        <span style={{
                          fontFamily: "'JetBrains Mono', monospace", fontSize: '10px',
                          color: 'rgba(255,255,255,0.15)',
                        }}>
                          built {timeAgo(tool.created_at)}
                        </span>
                        {tool.last_invoked_at && (
                          <span style={{
                            fontFamily: "'JetBrains Mono', monospace", fontSize: '10px',
                            color: 'rgba(255,255,255,0.15)',
                          }}>
                            last used {timeAgo(tool.last_invoked_at)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 16 }}>
                      <div style={{
                        fontFamily: "'Newsreader', serif", fontSize: '11px',
                        color: 'rgba(255,255,255,0.15)', fontStyle: 'italic',
                      }}>by Mira</div>
                      <span style={{
                        fontSize: '10px', color: 'rgba(255,255,255,0.1)',
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s', display: 'inline-block',
                      }}>▾</span>
                    </div>
                  </div>

                  {/* Expanded: show code */}
                  {isExpanded && (
                    <div style={{
                      borderTop: '1px solid rgba(255,255,255,0.04)',
                      padding: '16px 22px 22px',
                      animation: 'fadeIn 0.3s ease-out',
                    }}>
                      <div style={{
                        fontSize: '9px', fontWeight: 600, textTransform: 'uppercase',
                        letterSpacing: '0.14em', color: 'rgba(251,146,60,0.3)',
                        marginBottom: 10, fontFamily: "'JetBrains Mono', monospace",
                      }}>Source Code · autonomously written</div>
                      <pre style={{
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid rgba(255,255,255,0.03)',
                        borderRadius: '10px', padding: '16px',
                        fontSize: '11px', lineHeight: 1.65,
                        color: 'rgba(255,255,255,0.45)',
                        fontFamily: "'JetBrains Mono', monospace",
                        maxHeight: 500, overflowY: 'auto',
                      }}>
                        <code>{tool.code}</code>
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Forge Activity Feed */}
          <div style={{
            marginTop: 40,
            fontSize: '9.5px', fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: '0.14em', color: 'rgba(251,146,60,0.4)',
            marginBottom: 14, fontFamily: "'JetBrains Mono', monospace",
          }}>Forge Activity</div>

          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: '14px', padding: '16px 20px',
            maxHeight: 400, overflowY: 'auto',
          }}>
            {events.map((e, i) => {
              const isSuccess = e.phase === 'deployed' || e.phase === 'invoke_success' || e.phase === 'test_passed';
              const isFail = e.phase === 'invoke_failed' || e.phase === 'deploy_failed';
              const skillName = e.details?.target_skill || e.details?.function_name || e.details?.description?.slice(0, 60) || '';

              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '8px 4px',
                  borderBottom: i < events.length - 1 ? '1px solid rgba(255,255,255,0.02)' : 'none',
                }}>
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: '9px',
                    color: 'rgba(255,255,255,0.12)', width: 50, flexShrink: 0, paddingTop: 1,
                  }}>c{e.cycle_number}</span>
                  <span style={{
                    fontSize: '10px', width: 14, textAlign: 'center', flexShrink: 0,
                    color: isSuccess ? '#10b981' : isFail ? '#f87171' : '#fbbf24',
                  }}>
                    {isSuccess ? '✓' : isFail ? '✕' : '◈'}
                  </span>
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: '9px',
                    fontWeight: 600, width: 80, flexShrink: 0, textTransform: 'uppercase',
                    color: isSuccess ? 'rgba(16,185,129,0.5)' : isFail ? 'rgba(248,113,113,0.5)' : 'rgba(251,191,36,0.5)',
                  }}>{e.phase.replace('_', ' ')}</span>
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: '10px',
                    color: 'rgba(255,255,255,0.25)', flex: 1,
                  }}>
                    {skillName}
                  </span>
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: '9px',
                    color: 'rgba(255,255,255,0.1)', flexShrink: 0,
                  }}>{timeAgo(e.created_at)}</span>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div style={{
            marginTop: 48, textAlign: 'center',
            fontFamily: "'JetBrains Mono', monospace", fontSize: '9px',
            color: 'rgba(255,255,255,0.08)', letterSpacing: '0.06em',
          }}>
            tools forged by autonomous agents ·{' '}
            <a href="https://agentsv2.com" style={{ color: 'rgba(255,255,255,0.12)', textDecoration: 'none' }}>agentsv2.com</a>
          </div>
        </div>
      </div>
    </>
  );
}
