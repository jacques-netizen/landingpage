'use client'

import { Fragment } from 'react'
import { clickable, css } from './runtime'

type Card = { title: string; label: string; used: string; pct: string; plats: string[]; img: string; go: () => void }

// Campaigns that have ended (owner request, 2026-10-07), under the active ones. Built from the
// campaigns screen's own heading and card, unchanged, so it looks like part of the design.
export function PastCampaigns({
  T,
  cards,
}: {
  T: { text: string; hair2: string; accentInk: string; muted: string }
  cards: Card[]
}) {
  return (
    <div style={css({ display: 'flex', flexDirection: 'column', gap: '18px', marginTop: '8px' })}>
      <div style={css({ font: "700 22px 'Plus Jakarta Sans'", letterSpacing: '-0.01em', color: T.text })}>
        Past campaigns
      </div>
      <div data-m="a-grid" style={css({ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px' })}>
        {cards.map((c, i) => (
          <Fragment key={i}>
            <div
              {...clickable(c.go)}
              style={css({
                position: 'relative',
                height: '330px',
                borderRadius: '24px',
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.12)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.35)',
              })}
            >
              <img
                src={c.img}
                alt=""
                style={css({ position: 'absolute', inset: '0', width: '100%', height: '100%', objectFit: 'cover' })}
              />
              <div style={css({ position: 'absolute', left: '12px', top: '12px', display: 'flex', gap: '6px' })}>
                {c.plats.map((p, j) => (
                  <span
                    key={j}
                    style={css({
                      height: '26px',
                      padding: '0 10px',
                      borderRadius: '999px',
                      color: '#F4F1EA',
                      background: 'rgba(12,10,18,0.55)',
                      backdropFilter: 'blur(10px)',
                      WebkitBackdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255,255,255,0.18)',
                      display: 'flex',
                      alignItems: 'center',
                      font: "600 11px 'Plus Jakarta Sans'",
                    })}
                  >
                    {p}
                  </span>
                ))}
              </div>
              <div
                style={css({
                  position: 'absolute',
                  left: '10px',
                  right: '10px',
                  bottom: '10px',
                  padding: '14px 14px 12px',
                  borderRadius: '18px',
                  color: '#F4F1EA',
                  background: 'rgba(12,10,18,0.5)',
                  backdropFilter: 'blur(18px)',
                  WebkitBackdropFilter: 'blur(18px)',
                  border: `1px solid ${T.hair2}`,
                })}
              >
                <div style={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'center' })}>
                  <span style={css({ font: "700 15px 'Plus Jakarta Sans'" })}>{c.title}</span>
                  <span style={css({ font: "600 11px 'Plus Jakarta Sans'", color: T.accentInk })}>{c.label}</span>
                </div>
                <div style={css({ marginTop: '10px', height: '4px', borderRadius: '2px', background: T.hair2 })}>
                  <div style={css({ width: c.pct, height: '100%', borderRadius: '2px', background: '#D8C58F' })} />
                </div>
                <div
                  style={css({
                    marginTop: '10px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    font: "600 12px 'Plus Jakarta Sans'",
                    fontVariantNumeric: 'tabular-nums',
                  })}
                >
                  {/* Paid out of the budget, without the rate (testing report, 2026-10-08). */}
                  <span>{c.used}</span>
                </div>
              </div>
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  )
}
