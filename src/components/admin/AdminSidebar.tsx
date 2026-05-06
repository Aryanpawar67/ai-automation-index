"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

function IMochaLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 51 51" fill="none" style={{ flexShrink: 0 }}>
      <path d="M50.085 20.368C49.736 18.111 48.861 15.855 47.812 13.772C46.762 14.466 45.538 14.813 44.139 14.813C40.29 14.813 37.142 11.689 37.142 7.871C37.142 6.308 37.667 4.92 38.541 3.705C35.743 1.969 32.769 0.754 29.446 0.06C28.046 -0.287 26.822 0.928 26.822 2.316V8.218C26.822 9.259 27.522 10.3 28.571 10.474C33.819 11.863 38.017 15.855 39.416 21.062C39.766 22.103 40.64 22.798 41.69 22.798H47.637C49.211 23.145 50.435 21.756 50.085 20.368Z" fill="#FD5A0F"/>
      <path d="M10.73 21.409C12.129 16.202 16.327 12.036 21.575 10.821C22.624 10.474 23.324 9.606 23.324 8.565V2.49C23.324 1.101 21.925 -0.114 20.7 0.234C10.205 2.143 1.984 10.127 0.06 20.368C-0.289 21.756 0.935 23.145 2.334 23.145H8.456C9.506 23.145 10.555 22.277 10.73 21.409Z" fill="#FD5A0F"/>
      <path d="M21.575 39.46C16.327 38.072 12.129 34.08 10.73 28.873C10.38 27.831 9.506 27.137 8.456 27.137H2.334C0.935 27.137 -0.289 28.525 0.06 29.914C1.984 40.154 10.205 48.139 20.525 50.048C21.925 50.395 23.149 49.18 23.149 47.792V41.89C23.324 40.502 22.624 39.634 21.575 39.46Z" fill="#FD5A0F"/>
      <path d="M39.591 28.699C38.192 33.906 33.994 37.898 28.746 39.287C27.697 39.634 26.997 40.502 26.997 41.543V47.444C26.997 48.833 28.396 50.048 29.621 49.701C39.941 47.792 48.162 39.807 50.086 29.567C50.436 28.178 49.211 26.79 47.812 26.79H41.69C40.64 26.963 39.766 27.658 39.591 28.699Z" fill="#FD5A0F"/>
    </svg>
  );
}

const NAV_ITEMS = [
  {
    href: "/admin/dataset",
    exact: false,
    label: "Dataset",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
        <ellipse cx="12" cy="6" rx="8" ry="3" stroke="currentColor" strokeWidth="1.6"/>
        <path d="M4 6v4c0 1.657 3.582 3 8 3s8-1.343 8-3V6" stroke="currentColor" strokeWidth="1.6"/>
        <path d="M4 10v4c0 1.657 3.582 3 8 3s8-1.343 8-3v-4" stroke="currentColor" strokeWidth="1.6"/>
        <path d="M4 14v4c0 1.657 3.582 3 8 3s8-1.343 8-3v-4" stroke="currentColor" strokeWidth="1.6"/>
      </svg>
    ),
  },
  {
    href: "/admin/batches",
    exact: false,
    label: "Batches",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
        <rect x="3" y="14" width="18" height="6" rx="2" stroke="currentColor" strokeWidth="1.6"/>
        <rect x="3" y="7"  width="18" height="6" rx="2" stroke="currentColor" strokeWidth="1.6"/>
        <rect x="3" y="3"  width="18" height="3" rx="1.5" stroke="currentColor" strokeWidth="1.4" strokeOpacity="0.5"/>
      </svg>
    ),
  },
  {
    href: "/admin/enrichment",
    exact: false,
    label: "Enrichment",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6"/>
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: "/admin/leads",
    exact: false,
    label: "Leads",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
        <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="1.6"/>
        <path d="M2 8l10 7 10-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: "/admin/downloads",
    exact: false,
    label: "Downloads",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
        <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: "/admin",
    exact: true,
    label: "Quick Upload",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
        <path d="M12 16V4m0 0l-4 4m4-4l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M4 20h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    ),
  },
];

export default function AdminSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  function isActive(item: typeof NAV_ITEMS[0]) {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  }

  return (
    <aside
      style={{
        width:           collapsed ? 64 : 240,
        minHeight:       "100vh",
        background:      "#160022",
        borderRight:     "1px solid rgba(255,255,255,0.06)",
        display:         "flex",
        flexDirection:   "column",
        transition:      "width 0.25s cubic-bezier(0.4,0,0.2,1)",
        flexShrink:      0,
        position:        "sticky",
        top:             0,
        height:          "100vh",
        overflowX:       "hidden",
        overflowY:       "auto",
        zIndex:          50,
      }}
    >
      {/* ── Logo ── */}
      <div style={{
        padding:       collapsed ? "22px 0" : "22px 20px",
        borderBottom:  "1px solid rgba(255,255,255,0.06)",
        display:       "flex",
        alignItems:    "center",
        gap:           10,
        justifyContent: collapsed ? "center" : "flex-start",
        minHeight:     72,
        overflow:      "hidden",
      }}>
        <IMochaLogo size={28} />
        <div style={{
          opacity:    collapsed ? 0 : 1,
          transform:  collapsed ? "translateX(-8px)" : "translateX(0)",
          transition: "opacity 0.2s ease, transform 0.2s ease",
          whiteSpace: "nowrap",
          overflow:   "hidden",
        }}>
          <p style={{ color: "#fff", fontWeight: 800, fontSize: 15, lineHeight: 1.2, margin: 0 }}>iMocha</p>
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", margin: 0 }}>Admin Console</p>
        </div>
      </div>

      {/* ── Nav items ── */}
      <nav style={{ flex: 1, padding: "16px 0" }}>
        {NAV_ITEMS.map(item => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              style={{
                display:        "flex",
                alignItems:     "center",
                gap:            12,
                padding:        collapsed ? "13px 0" : "13px 20px",
                justifyContent: collapsed ? "center" : "flex-start",
                color:          active ? "#FD5A0F" : "rgba(255,255,255,0.5)",
                borderLeft:     active ? "3px solid #FD5A0F" : "3px solid transparent",
                background:     active ? "rgba(253,90,15,0.1)" : "transparent",
                transition:     "background 0.15s, color 0.15s, border-color 0.15s",
                textDecoration: "none",
                fontSize:       14,
                fontWeight:     active ? 700 : 500,
                position:       "relative",
                whiteSpace:     "nowrap",
                overflow:       "hidden",
              }}
              onMouseEnter={e => {
                if (!active) {
                  (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.05)";
                  (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.85)";
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                  (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.5)";
                }
              }}
            >
              <span style={{ flexShrink: 0, display: "flex" }}>{item.icon}</span>
              <span style={{
                opacity:    collapsed ? 0 : 1,
                transform:  collapsed ? "translateX(-6px)" : "translateX(0)",
                transition: "opacity 0.18s ease, transform 0.18s ease",
              }}>
                {item.label}
              </span>

              {/* Active dot indicator when collapsed */}
              {active && collapsed && (
                <span style={{
                  position:     "absolute",
                  right:        6,
                  top:          "50%",
                  transform:    "translateY(-50%)",
                  width:        5,
                  height:       5,
                  borderRadius: "50%",
                  background:   "#FD5A0F",
                }} />
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── Divider + version tag ── */}
      {!collapsed && (
        <div style={{
          margin:     "0 20px 12px",
          padding:    "12px 0 0",
          borderTop:  "1px solid rgba(255,255,255,0.06)",
          opacity:    collapsed ? 0 : 1,
          transition: "opacity 0.2s ease",
        }}>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", letterSpacing: "0.06em", margin: 0 }}>
            AI Automation Index
          </p>
        </div>
      )}

      {/* ── Collapse toggle ── */}
      <div style={{
        padding:     "14px",
        borderTop:   "1px solid rgba(255,255,255,0.06)",
        display:     "flex",
        justifyContent: collapsed ? "center" : "flex-end",
      }}>
        <button
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          style={{
            width:        32,
            height:       32,
            display:      "flex",
            alignItems:   "center",
            justifyContent: "center",
            background:   "rgba(255,255,255,0.05)",
            border:       "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8,
            cursor:       "pointer",
            color:        "rgba(255,255,255,0.4)",
            transition:   "background 0.15s, color 0.15s",
            flexShrink:   0,
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(253,90,15,0.15)";
            (e.currentTarget as HTMLButtonElement).style.color = "#FD5A0F";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)";
            (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.4)";
          }}
        >
          <svg
            width="14" height="14" fill="none" viewBox="0 0 16 16"
            style={{ transform: collapsed ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.25s ease" }}
          >
            <path d="M10 3L6 8l4 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </aside>
  );
}
