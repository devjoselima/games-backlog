import { CheckCircle2, Award } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function GamesTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const total = payload[0]?.value ?? 0;

  return (
    <div className="min-w-[165px] rounded-xl border border-white/15 bg-[#14171F]/95 p-3 shadow-2xl backdrop-blur-md">
      <div className="mb-2 flex items-center justify-between border-b border-white/10 pb-1.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
          Ano {label}
        </span>
        <span className="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e]" />
      </div>
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-xs text-slate-300">Jogos zerados</span>
        <span className="font-display text-lg font-bold tabular-nums text-white">
          {total}
        </span>
      </div>
      <p className="mt-1.5 text-[10px] text-slate-400">
        Clique na barra para filtrar o ano
      </p>
    </div>
  );
}

function TrophiesTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload;
  const total = data?.total ?? payload[0]?.value ?? 0;
  const steam = data?.steam ?? 0;
  const psn = data?.psn ?? 0;

  return (
    <div className="min-w-[190px] rounded-xl border border-amber-500/30 bg-[#14171F]/95 p-3.5 shadow-2xl backdrop-blur-md">
      <div className="mb-2.5 flex items-center justify-between border-b border-white/10 pb-1.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-amber-300">
          Ano {label}
        </span>
        <span className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24]" />
      </div>

      <div className="flex items-baseline justify-between gap-4">
        <span className="text-xs font-medium text-slate-200">Total no ano</span>
        <span className="font-display text-xl font-bold tabular-nums text-amber-400">
          {total}
        </span>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-1.5 border-t border-white/10 pt-2 text-xs">
        <div className="flex items-center justify-between rounded-md bg-white/[0.05] px-2 py-1">
          <span className="text-[11px] text-slate-300">Steam</span>
          <span className="font-display font-semibold tabular-nums text-white">
            {steam}
          </span>
        </div>
        <div className="flex items-center justify-between rounded-md bg-white/[0.05] px-2 py-1">
          <span className="text-[11px] text-slate-300">PSN</span>
          <span className="font-display font-semibold tabular-nums text-white">
            {psn}
          </span>
        </div>
      </div>
    </div>
  );
}

export function DashboardCharts({
  byYear,
  trophiesByYear,
  selectedYear,
  onSelectYear,
}: {
  byYear: Array<{ ano: string; total: number }>;
  trophiesByYear: Array<{ ano: string; total: number; steam: number; psn: number }>;
  selectedYear: string;
  onSelectYear: (year: string) => void;
}) {
  const totalGamesAllYears = byYear.reduce((acc, item) => acc + item.total, 0);
  const totalTrophiesAllYears = trophiesByYear.reduce((acc, item) => acc + item.total, 0);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Gráfico 1: Jogos Concluídos por Ano */}
      <section className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-b from-[#201922]/70 via-surface to-surface p-5 shadow-lg">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-primary/15 p-2 text-primary">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Evolução de jogos concluídos por ano
              </h2>
              <p className="text-xs text-muted-foreground">
                Clique em uma barra para filtrar ou alternar o ano
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-rose-300">
            {totalGamesAllYears} no total
          </span>
        </div>

        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byYear} margin={{ top: 22, right: 8, left: -22, bottom: 0 }}>
              <defs>
                <linearGradient id="gamesBarActive" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FB7185" stopOpacity={1} />
                  <stop offset="100%" stopColor="#E11D48" stopOpacity={0.85} />
                </linearGradient>
                <linearGradient id="gamesBarDim" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#333947" stopOpacity={0.65} />
                  <stop offset="100%" stopColor="#232730" stopOpacity={0.45} />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                strokeDasharray="3 3"
                stroke="rgba(255, 255, 255, 0.06)"
              />
              <XAxis
                dataKey="ano"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "#CBD5E1", fontWeight: 500 }}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "#94A3B8" }}
              />
              <Tooltip
                cursor={{ fill: "rgba(255, 255, 255, 0.04)", radius: 6 }}
                content={<GamesTooltip />}
              />
              <Bar
                dataKey="total"
                name="Jogos concluídos"
                fill="url(#gamesBarActive)"
                radius={[6, 6, 2, 2]}
                maxBarSize={48}
                className="cursor-pointer"
                onClick={(data) => {
                  if (data?.ano) {
                    onSelectYear(String(data.ano));
                  }
                }}
              >
                {byYear.map((entry) => {
                  const isActive =
                    selectedYear === "All" || selectedYear === entry.ano;
                  return (
                    <Cell
                      key={entry.ano}
                      fill={isActive ? "url(#gamesBarActive)" : "url(#gamesBarDim)"}
                    />
                  );
                })}
                <LabelList
                  dataKey="total"
                  position="top"
                  offset={6}
                  style={{
                    fill: "#F8FAFC",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Gráfico 2: Total de Troféus por Ano */}
      <section className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-b from-[#231F17]/70 via-surface to-surface p-5 shadow-lg">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-amber-500/15 p-2 text-amber-400">
              <Award className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Total de troféus por ano
              </h2>
              <p className="text-xs text-muted-foreground">
                Conquistas da Steam + troféus da PSN sincronizados
              </p>
            </div>
          </div>
          {trophiesByYear.length > 0 && (
            <span className="shrink-0 rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-amber-300">
              {totalTrophiesAllYears} acumulados
            </span>
          )}
        </div>

        {trophiesByYear.length === 0 ? (
          <div className="flex h-[260px] items-center justify-center text-center text-xs text-muted-foreground">
            Nenhum ano sincronizado ainda. Use o botão Sync no card de Troféus acima.
          </div>
        ) : (
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={trophiesByYear}
                margin={{ top: 22, right: 8, left: -14, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="trophiesBarActive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FBBF24" stopOpacity={1} />
                    <stop offset="100%" stopColor="#D97706" stopOpacity={0.85} />
                  </linearGradient>
                  <linearGradient id="trophiesBarDim" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#333947" stopOpacity={0.65} />
                    <stop offset="100%" stopColor="#232730" stopOpacity={0.45} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  strokeDasharray="3 3"
                  stroke="rgba(255, 255, 255, 0.06)"
                />
                <XAxis
                  dataKey="ano"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#CBD5E1", fontWeight: 500 }}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#94A3B8" }}
                />
                <Tooltip
                  cursor={{ fill: "rgba(255, 255, 255, 0.04)", radius: 6 }}
                  content={<TrophiesTooltip />}
                />
                <Bar
                  dataKey="total"
                  name="Troféus"
                  fill="url(#trophiesBarActive)"
                  radius={[6, 6, 2, 2]}
                  maxBarSize={48}
                  className="cursor-pointer"
                  onClick={(data) => {
                    if (data?.ano) {
                      onSelectYear(String(data.ano));
                    }
                  }}
                >
                  {trophiesByYear.map((entry) => {
                    const isActive =
                      selectedYear === "All" || selectedYear === entry.ano;
                    return (
                      <Cell
                        key={entry.ano}
                        fill={
                          isActive
                            ? "url(#trophiesBarActive)"
                            : "url(#trophiesBarDim)"
                        }
                      />
                    );
                  })}
                  <LabelList
                    dataKey="total"
                    position="top"
                    offset={6}
                    style={{
                      fill: "#F8FAFC",
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  );
}

export default DashboardCharts;
