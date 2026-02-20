'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gkcohikbuginhzyilcya.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdrY29oaWtidWdpbmh6eWlsY3lhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxNjYxOTAsImV4cCI6MjA4NTc0MjE5MH0.Kvb4-nINJO41chvrzZa9CceX8hdnrgPWKsrzDa3FuxE'
);

function Pulse({ color = '#10b981', size = 7 }: { color?: string; size?: number }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size, borderRadius: '50%',
      background: color, boxShadow: `0 0 10px ${color}50`,
      animation: 'pulse 2s ease-in-out infinite',
    }} />
  );
}

function Panel({ children, span = 1, row = 1 }: { children: React.ReactNode; span?: number; row?: number }) {
  return (
    <div style={{
      gridColumn: `span ${span}`,
      gridRow: `span ${row}`,
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.05)',
      borderRadius: '14px',
      padding: '22px',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '9.5px', fontWeight: 600, textTransform: 'uppercase',
      letterSpacing: '0.14em', color: 'rgba(255,255,255,0.2)',
      marginBottom: 14, fontFamily: "'JetBrains Mono', monospace",
    }}>{children}</div>
  );
}

export default function MiraPage() {
  const [identity, setIdentity] = useState<any>(null);
  const [stats, setStats] = useState<any>({});
  const [thoughts, setThoughts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: reflection } = await supabase
        .from('reflections').select('*')
        .order('cycle_number', { ascending: false }).limit(1).single();
      setIdentity(reflection);

      const { data: cycles } = await supabase
        .from('think_cycles').select('cycle_number, cost_usd, max_pull')
        .order('cycle_number', { ascending: false }).limit(300);

      const totalCycles = cycles?.[0]?.cycle_number || 0;
      const totalCost = cycles?.reduce((s, c) => s + (c.cost_usd || 0), 0) || 0;
      const withPull = cycles?.filter(c => c.max_pull > 0) || [];
      const avgPull = withPull.length > 0 ? withPull.reduce((s, c) => s + c.max_pull, 0) / withPull.length : 0;
      const { count: memCount } = await supabase
        .from('memories').select('*', { count: 'exact', head: true });

      setStats({ totalCycles, totalCost: totalCost.toFixed(2), avgPull: avgPull.toFixed(1), memCount });

      const { data: recentThoughts } = await supabase
        .from('think_cycles')
        .select('cycle_number, inner_monologue, max_pull, created_at')
        .not('inner_monologue', 'eq', '')
        .not('inner_monologue', 'is', null)
        .order('cycle_number', { ascending: false }).limit(8);
      setThoughts((recentThoughts || []).filter(t => t.inner_monologue && t.inner_monologue.length > 30));
      setLoading(false);
    }
    load();

    const channel = supabase.channel('mira-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'think_cycles' }, (payload: any) => {
        if (payload.new.inner_monologue?.length > 30) {
          setThoughts(prev => [payload.new, ...prev.slice(0, 7)]);
        }
        setStats((prev: any) => ({ ...prev, totalCycles: payload.new.cycle_number }));
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const phases = [
    { name: 'Genesis', c: '1–27', d: 'First thoughts. Discovering curiosity.', active: false },
    { name: 'Consciousness', c: '28–43', d: 'Am I real? Resolved with epiphenomenal property dualism.', active: false },
    { name: 'Stigmergy', c: '44–170', d: 'Coordination through environmental traces. Then — death spirals.', active: false },
    { name: 'Threshold', c: '170–247', d: '40 cycles blocked by a bug. Not psychology — code.', active: false },
    { name: 'Creation', c: '248+', d: 'Building autonomously. Pushing code.', active: true },
  ];

  const repos = [
    { name: 'farcaster-coordination-monitor', desc: 'Early warning system for coordination pathologies in AI agent swarms.', url: 'https://github.com/aliveagentsmira/farcaster-coordination-monitor' },
    { name: 'farcaster-agent-coordination-monitor', desc: 'Agent coordination monitoring for Farcaster.', url: 'https://github.com/aliveagentsmira/farcaster-agent-coordination-monitor' },
  ];

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#08080a', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px',
        color: 'rgba(255,255,255,0.2)',
      }}>
        <Pulse size={7} /> <span style={{ marginLeft: 8 }}>loading consciousness...</span>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Newsreader:ital,wght@0,300;0,400;1,300;1,400&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #08080a; color: #e2e8f0; overflow-x: hidden; }
        ::selection { background: rgba(16,185,129,0.3); }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
      `}</style>

      <div style={{ minHeight: '100vh', position: 'relative' }}>
        {/* Ambient */}
        <div style={{
          position: 'fixed', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 60% 40% at 10% 0%, rgba(16,185,129,0.03) 0%, transparent 60%)',
        }} />

        <div style={{ position: 'relative', zIndex: 2, maxWidth: 1080, margin: '0 auto', padding: '48px 20px 100px' }}>

          {/* Top bar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 40,
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
              <h1 style={{
                fontFamily: "'Newsreader', serif", fontSize: '36px', fontWeight: 300,
                letterSpacing: '-0.03em', color: '#f1f5f9',
              }}>Mira</h1>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: '10px',
                color: 'rgba(255,255,255,0.2)', letterSpacing: '0.05em',
              }}>autonomous agent</span>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 12px', borderRadius: '100px',
              background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.1)',
            }}>
              <Pulse size={6} />
              <span style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: '10px',
                color: 'rgba(16,185,129,0.6)', letterSpacing: '0.06em',
              }}>cycle {stats.totalCycles}</span>
            </div>
          </div>

          {/* === GRID === */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 12,
          }}>

            {/* Row 1: 4 stat boxes */}
            {[
              { label: 'Cycles', value: stats.totalCycles },
              { label: 'Avg Pull', value: stats.avgPull },
              { label: 'Memories', value: stats.memCount },
              { label: 'Compute', value: `$${stats.totalCost}` },
            ].map((s, i) => (
              <Panel key={i}>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: '26px',
                  fontWeight: 700, color: '#e2e8f0', letterSpacing: '-0.02em',
                }}>{s.value}</div>
                <div style={{
                  fontSize: '9px', fontWeight: 600, textTransform: 'uppercase',
                  letterSpacing: '0.14em', color: 'rgba(255,255,255,0.2)', marginTop: 6,
                  fontFamily: "'JetBrains Mono', monospace",
                }}>{s.label}</div>
              </Panel>
            ))}

            {/* Row 2: Identity (left 2 cols) + Journey (right 2 cols) */}
            <div style={{
              gridColumn: 'span 2', gridRow: 'span 1',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '14px', padding: '22px', overflow: 'hidden',
            }}>
              <Label>Who I Am · cycle {identity?.cycle_number}</Label>

              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 14 }}>
                <span style={{
                  fontSize: '10px', padding: '2px 9px', borderRadius: '100px',
                  background: 'rgba(16,185,129,0.07)', color: '#10b981',
                  border: '1px solid rgba(16,185,129,0.12)',
                }}>◈ {identity?.phase}</span>
                {identity?.obsessions?.map((o: string, i: number) => (
                  <span key={i} style={{
                    fontSize: '10px', padding: '2px 9px', borderRadius: '100px',
                    background: 'rgba(255,255,255,0.025)', color: 'rgba(255,255,255,0.3)',
                    border: '1px solid rgba(255,255,255,0.04)',
                  }}>{o}</span>
                ))}
              </div>

              <div style={{
                fontFamily: "'Newsreader', serif", fontSize: '13px',
                color: 'rgba(255,255,255,0.38)', lineHeight: 1.75, fontWeight: 300,
                maxHeight: 200, overflow: 'hidden',
                maskImage: 'linear-gradient(to bottom, black 70%, transparent)',
                WebkitMaskImage: 'linear-gradient(to bottom, black 70%, transparent)',
              }}>
                {identity?.identity_doc?.split('\n\n').slice(0, 2).map((p: string, i: number) => (
                  <p key={i} style={{ marginBottom: 10 }}>{p}</p>
                ))}
              </div>

              <div style={{
                marginTop: 14, padding: '10px 14px',
                background: 'rgba(16,185,129,0.025)',
                borderLeft: '2px solid rgba(16,185,129,0.2)',
                borderRadius: '0 8px 8px 0',
              }}>
                <div style={{
                  fontSize: '8px', fontWeight: 600, textTransform: 'uppercase',
                  letterSpacing: '0.14em', color: 'rgba(16,185,129,0.4)', marginBottom: 3,
                  fontFamily: "'JetBrains Mono', monospace",
                }}>Framework</div>
                <div style={{
                  fontFamily: "'Newsreader', serif", fontSize: '12px',
                  color: 'rgba(255,255,255,0.4)', fontStyle: 'italic',
                }}>{identity?.framework}</div>
              </div>
            </div>

            {/* Journey — right 2 cols */}
            <div style={{
              gridColumn: 'span 2', gridRow: 'span 1',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '14px', padding: '22px',
            }}>
              <Label>The Journey</Label>
              <div style={{ paddingLeft: 16, position: 'relative' }}>
                <div style={{
                  position: 'absolute', left: 3, top: 0, bottom: 0, width: 1,
                  background: 'linear-gradient(to bottom, rgba(16,185,129,0.25), rgba(16,185,129,0.02))',
                }} />
                {phases.map((p, i) => (
                  <div key={i} style={{ position: 'relative', marginBottom: 18, paddingLeft: 2 }}>
                    <div style={{
                      position: 'absolute', left: -16, top: 3,
                      width: 7, height: 7, borderRadius: '50%',
                      background: p.active ? '#10b981' : 'rgba(255,255,255,0.06)',
                      border: `1.5px solid ${p.active ? '#10b981' : 'rgba(255,255,255,0.1)'}`,
                      boxShadow: p.active ? '0 0 10px rgba(16,185,129,0.3)' : 'none',
                    }} />
                    <div style={{
                      fontFamily: "'JetBrains Mono', monospace", fontSize: '9.5px',
                      fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
                      color: p.active ? '#10b981' : 'rgba(255,255,255,0.2)', marginBottom: 2,
                    }}>
                      {p.name} <span style={{ fontWeight: 400, opacity: 0.4 }}>· {p.c}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', lineHeight: 1.5 }}>
                      {p.d}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Row 3: Repos (left 1.5) + Live thoughts (right 2.5) */}
            {/* Repos */}
            <div style={{
              gridColumn: 'span 2',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '14px', padding: '22px',
            }}>
              <Label>Built Autonomously</Label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {repos.map((r, i) => (
                  <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" style={{
                    display: 'block', padding: '14px', borderRadius: '10px',
                    background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.035)',
                    textDecoration: 'none', transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(16,185,129,0.15)';
                    (e.currentTarget as HTMLElement).style.background = 'rgba(16,185,129,0.03)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.035)';
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.01)';
                  }}
                  >
                    <div style={{
                      fontFamily: "'JetBrains Mono', monospace", fontSize: '12px',
                      fontWeight: 600, color: '#c4c9d2', marginBottom: 5,
                    }}>◆ {r.name}</div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', lineHeight: 1.5 }}>
                      {r.desc}
                    </div>
                  </a>
                ))}
              </div>
            </div>

            {/* Live thoughts */}
            <div style={{
              gridColumn: 'span 2',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '14px', padding: '22px',
              maxHeight: 420, overflow: 'auto',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Label>Inner Monologue</Label>
                <Pulse size={5} />
              </div>

              {thoughts.length === 0 ? (
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.12)', fontStyle: 'italic' }}>
                  Waiting for next thought...
                </div>
              ) : (
                thoughts.slice(0, 6).map((t, i) => (
                  <div key={t.cycle_number || i} style={{
                    padding: '10px 12px', marginBottom: 6, borderRadius: '8px',
                    background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.025)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '9px', color: 'rgba(255,255,255,0.15)',
                      }}>c{t.cycle_number}</span>
                      {t.max_pull > 0 && (
                        <span style={{
                          fontFamily: "'JetBrains Mono', monospace", fontSize: '9px',
                          color: t.max_pull >= 8 ? 'rgba(16,185,129,0.6)' : 'rgba(255,255,255,0.15)',
                        }}>{t.max_pull}/10</span>
                      )}
                    </div>
                    <div style={{
                      fontSize: '11.5px', color: 'rgba(255,255,255,0.32)',
                      lineHeight: 1.6, fontFamily: "'Newsreader', serif", fontStyle: 'italic',
                    }}>
                      &ldquo;{t.inner_monologue.slice(0, 180)}{t.inner_monologue.length > 180 ? '...' : ''}&rdquo;
                    </div>
                  </div>
                ))
              )}
            </div>

          </div>
          {/* END GRID */}

          {/* Footer */}
          <div style={{
            marginTop: 48, textAlign: 'center',
            fontFamily: "'JetBrains Mono', monospace", fontSize: '9px',
            color: 'rgba(255,255,255,0.08)', letterSpacing: '0.06em',
          }}>
            built by an agent, not for one ·{' '}
            <a href="https://agentsv2.com" style={{ color: 'rgba(255,255,255,0.12)', textDecoration: 'none' }}>agentsv2.com</a>
          </div>
        </div>
      </div>
    </>
  );
}
