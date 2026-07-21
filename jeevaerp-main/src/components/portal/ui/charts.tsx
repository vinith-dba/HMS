"use client";

export interface Point { label: string; value: number; }

/** Line chart that draws itself in. Pure SVG, no deps. */
export function LineChart({ data, height = 220 }: { data: Point[]; height?: number }) {
  const w = 640, pad = 30;
  const vals = data.map((d) => d.value);
  const min = Math.min(...vals), max = Math.max(...vals);
  const stepX = (w - pad * 2) / (data.length - 1);
  const y = (v: number) => height - pad - ((v - min) / (max - min || 1)) * (height - pad * 2);
  const pts = data.map((d, i) => [pad + i * stepX, y(d.value)] as const);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0]},${height - pad} L${pts[0][0]},${height - pad} Z`;
  // rough path length for dash animation
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i-1][0], pts[i][1] - pts[i-1][1]);

  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} role="img">
      {[0, 1, 2, 3].map((i) => {
        const gy = pad + (i * (height - pad * 2)) / 3;
        return <line key={i} x1={pad} y1={gy} x2={w - pad} y2={gy} stroke="#eef0f4" />;
      })}
      <path className="chart-area" d={area} fill="rgba(13,125,130,0.08)" />
      <path className="chart-line" style={{ ["--len" as string]: len } as React.CSSProperties}
        d={line} fill="none" stroke="var(--p-teal)" strokeWidth={2.2} strokeLinecap="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={3} fill="var(--p-teal)"
          style={{ opacity: 0, animation: `fadeArea .4s ease ${0.9 + i * 0.03}s forwards` }}>
          <title>{`${data[i].label}: ${data[i].value}`}</title>
        </circle>
      ))}
      {data.map((d, i) => i % Math.ceil(data.length / 6) === 0 ? (
        <text key={i} x={pad + i * stepX} y={height - 8} textAnchor="middle"
          fontSize={10} fill="var(--p-muted)">{d.label}</text>
      ) : null)}
    </svg>
  );
}

/** Donut via conic-gradient with a fade/scale in. */
export function Donut({ data }: { data: { label: string; value: number; color: string }[] }) {
  let acc = 0;
  const stops = data.map((d) => {
    const s = acc, e = acc + d.value; acc = e;
    return `${d.color} ${s}% ${e}%`;
  }).join(", ");
  return (
    <div className="flex flex-col items-center gap-4">
      <div
        data-enter
        className="h-[150px] w-[150px] rounded-full"
        style={{ background: `conic-gradient(${stops})` }}
      />
      <div className="w-full space-y-1.5">
        {data.map((d) => (
          <div key={d.label} className="flex items-center justify-between text-[13px]">
            <span className="flex items-center gap-2 text-[var(--p-text)]">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: d.color }} />
              {d.label}
            </span>
            <span className="text-[var(--p-muted)]">{d.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
