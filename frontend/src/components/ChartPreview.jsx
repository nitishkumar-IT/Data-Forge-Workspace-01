import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COLORS = ["#0f766e", "#f97316", "#2563eb", "#dc2626", "#7c3aed", "#059669", "#0891b2", "#ca8a04"];

function formatLabel(value) {
  const text = String(value ?? "").trim();
  if (!text) return "Blank";
  return text.length > 18 ? `${text.slice(0, 16)}...` : text;
}

function formatNumber(value) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return String(value ?? "-");
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(numeric);
}

function formatPercent(value) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return "0%";
  return `${numeric.toFixed(1)}%`;
}

function toData(chart) {
  if (chart.type === "pie") {
    const total = (chart.values || []).reduce((sum, item) => sum + Number(item || 0), 0) || 1;
    return (chart.labels || []).map((label, index) => ({
      name: String(label ?? "Blank"),
      shortName: formatLabel(label),
      value: Number(chart.values?.[index] ?? 0),
      share: (Number(chart.values?.[index] ?? 0) / total) * 100,
    }));
  }

  if (chart.type === "scatter") {
    return (chart.x || []).map((item, index) => ({
      name: String(item ?? "Point"),
      shortName: formatLabel(item),
      xValue: Number(item),
      yValue: Number(chart.y?.[index] ?? 0),
      rawX: item,
    }));
  }

  return (chart.x || []).map((item, index) => ({
    name: String(item ?? "Blank"),
    shortName: formatLabel(item),
    value: Number(chart.y?.[index] ?? 0),
  }));
}

function renderTooltipValue(value) {
  return formatNumber(value);
}

export function ChartPreview({ chart, action, compact = false }) {
  const data = toData(chart);
  const palette = chart.palette || COLORS;
  const xLabel = chart.x_label || chart.x_axis || "X axis";
  const yLabel = chart.y_label || chart.y_axis || (chart.type === "pie" ? "Value" : "Y axis");
  const chartHeight = compact ? 230 : 280;

  return (
    <article className={compact ? "chart-card chart-card-compact" : "chart-card"}>
      <div className="chart-header">
        <div>
          <h4>{chart.title}</h4>
          {chart.aggregation ? <p className="chart-subtitle">{chart.aggregation}</p> : null}
        </div>
        <span>{chart.type}</span>
      </div>
      <div className="chart-meta-row">
        <span>{xLabel}</span>
        <span>{yLabel}</span>
        <span>{data.length} points</span>
      </div>
      <div className="chart-body">
        <ResponsiveContainer width="100%" height={chartHeight}>
          {chart.type === "line" ? (
            <LineChart data={data} margin={{ top: 12, right: 16, left: 6, bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d7e2ea" />
              <XAxis dataKey="shortName" angle={data.length > 7 ? -20 : 0} textAnchor={data.length > 7 ? "end" : "middle"} height={56} tick={{ fill: "#52657a", fontSize: 12 }} />
              <YAxis tickFormatter={formatNumber} width={72} tick={{ fill: "#52657a", fontSize: 12 }} />
              <Tooltip formatter={renderTooltipValue} labelFormatter={(label, payload) => payload?.[0]?.payload?.name || label} />
              <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }} />
            </LineChart>
          ) : chart.type === "scatter" ? (
            <ScatterChart margin={{ top: 12, right: 16, left: 6, bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d7e2ea" />
              <XAxis type="number" dataKey="xValue" name={xLabel} tickFormatter={formatNumber} tick={{ fill: "#52657a", fontSize: 12 }} />
              <YAxis type="number" dataKey="yValue" name={yLabel} tickFormatter={formatNumber} width={72} tick={{ fill: "#52657a", fontSize: 12 }} />
              <Tooltip cursor={{ strokeDasharray: "3 3" }} formatter={renderTooltipValue} labelFormatter={(_, payload) => payload?.[0]?.payload?.name || "Point"} />
              <Scatter data={data} fill="#0f766e" />
            </ScatterChart>
          ) : chart.type === "pie" ? (
            <PieChart>
              <Tooltip formatter={renderTooltipValue} labelFormatter={(label, payload) => payload?.[0]?.payload?.name || label} />
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                outerRadius={compact ? 78 : 92}
                innerRadius={compact ? 30 : 36}
                paddingAngle={2}
                label={({ shortName, share }) => `${shortName} (${formatPercent(share)})`}
                labelLine={false}
              >
                {data.map((entry, index) => (
                  <Cell key={entry.name} fill={palette[index % palette.length]} />
                ))}
              </Pie>
            </PieChart>
          ) : (
            <BarChart data={data} margin={{ top: 12, right: 16, left: 6, bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d7e2ea" />
              <XAxis dataKey="shortName" angle={data.length > 7 ? -20 : 0} textAnchor={data.length > 7 ? "end" : "middle"} height={56} tick={{ fill: "#52657a", fontSize: 12 }} />
              <YAxis tickFormatter={formatNumber} width={72} tick={{ fill: "#52657a", fontSize: 12 }} />
              <Tooltip formatter={renderTooltipValue} labelFormatter={(label, payload) => payload?.[0]?.payload?.name || label} />
              <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell key={entry.name} fill={palette[index % palette.length]} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      {action ? <div className="chart-footer">{action}</div> : null}
    </article>
  );
}
