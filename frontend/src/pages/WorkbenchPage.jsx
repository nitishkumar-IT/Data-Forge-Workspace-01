import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { ChartPreview } from "../components/ChartPreview";
import { MetricCard } from "../components/MetricCard";

const chartTypes = ["bar", "line", "scatter", "histogram", "box", "pie"];
const navItems = [
  { id: "overview", label: "Dashboard" },
  { id: "projects", label: "Projects" },
  { id: "ingest", label: "Upload" },
  { id: "preview", label: "Preview" },
  { id: "clean", label: "Clean" },
  { id: "eda", label: "EDA" },
  { id: "viz", label: "Visualize" },
  { id: "ml", label: "ML Training" },
];
const VIEW_KEY = "data_forge_active_view";
const PROJECT_KEY = "data_forge_active_project";
const DASHBOARD_VISUALS_KEY = "data_forge_dashboard_visuals";

function getDashboardVisualStorageKey(projectId) {
  return `${DASHBOARD_VISUALS_KEY}_${projectId}`;
}

function getChartSignature(chart) {
  return JSON.stringify({
    type: chart.type,
    title: chart.title,
    x: chart.x || null,
    y: chart.y || null,
    labels: chart.labels || null,
    values: chart.values || null,
  });
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function toPretty(value) {
  return String(value).replaceAll("_", " ");
}

function toTitle(value) {
  return toPretty(value).replace(/\b\w/g, (char) => char.toUpperCase());
}

function printDashboardPdf({ project, datasets, preview, cleaning, eda, visuals, training, history }) {
  const popup = window.open("", "_blank", "width=1280,height=900");
  if (!popup) throw new Error("Popup blocked. Allow popups to export the dashboard as PDF.");
  const safe = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  const palette = ["#0f766e", "#ea580c", "#2563eb", "#dc2626", "#7c3aed", "#0891b2"];
  const chartMarkup = (visuals || []).map((chart) => {
    const points = chart.type === "pie" ? (chart.labels || []).map((label, index) => ({ label, value: Number(chart.values?.[index] ?? 0) })) : (chart.x || []).slice(0, 10).map((label, index) => ({ label, value: Number(chart.y?.[index] ?? 0) }));
    const max = Math.max(...points.map((point) => point.value), 1);
    let graphic = "";
    if (chart.type === "pie") {
      let angle = -Math.PI / 2;
      const slices = points.map((point, index) => {
        const slice = (point.value / (points.reduce((sum, item) => sum + item.value, 0) || 1)) * Math.PI * 2;
        const x1 = 160 + Math.cos(angle) * 90;
        const y1 = 120 + Math.sin(angle) * 90;
        angle += slice;
        const x2 = 160 + Math.cos(angle) * 90;
        const y2 = 120 + Math.sin(angle) * 90;
        const arc = slice > Math.PI ? 1 : 0;
        return `<path d="M160 120 L${x1} ${y1} A90 90 0 ${arc} 1 ${x2} ${y2} Z" fill="${palette[index % palette.length]}" />`;
      }).join("");
      const legend = points.map((point, index) => `<div class="print-legend-item"><span class="print-swatch" style="background:${palette[index % palette.length]}"></span><span>${safe(point.label)}</span><b>${point.value}</b></div>`).join("");
      graphic = `<div class="print-pie-layout"><svg viewBox="0 0 320 240" xmlns="http://www.w3.org/2000/svg"><rect width="320" height="240" fill="#fff" rx="18" />${slices}</svg><div class="print-legend">${legend}</div></div>`;
    } else if (chart.type === "line") {
      const coords = points.map((point, index) => `${35 + index * (450 / Math.max(points.length - 1, 1))},${190 - (point.value / max) * 145}`).join(" ");
      const dots = points.map((point, index) => { const cx = 35 + index * (450 / Math.max(points.length - 1, 1)); const cy = 190 - (point.value / max) * 145; return `<circle cx="${cx}" cy="${cy}" r="5" fill="#2563eb" /><text x="${cx}" y="208" text-anchor="middle" font-size="11" fill="#14303d">${safe(String(point.label).slice(0, 10))}</text>`; }).join("");
      graphic = `<svg viewBox="0 0 520 250" xmlns="http://www.w3.org/2000/svg"><rect width="520" height="250" fill="#fff" rx="18" /><line x1="24" y1="190" x2="500" y2="190" stroke="#bfd0d8" stroke-width="2" /><polyline points="${coords}" fill="none" stroke="#2563eb" stroke-width="4" />${dots}</svg>`;
    } else if (chart.type === "scatter") {
      const dots = points.map((point, index) => { const cx = 35 + index * (450 / Math.max(points.length - 1, 1)); const cy = 190 - (point.value / max) * 145; return `<circle cx="${cx}" cy="${cy}" r="7" fill="${palette[index % palette.length]}" /><text x="${cx}" y="208" text-anchor="middle" font-size="11" fill="#14303d">${safe(String(point.label).slice(0, 10))}</text>`; }).join("");
      graphic = `<svg viewBox="0 0 520 250" xmlns="http://www.w3.org/2000/svg"><rect width="520" height="250" fill="#fff" rx="18" /><line x1="24" y1="190" x2="500" y2="190" stroke="#bfd0d8" stroke-width="2" /><line x1="24" y1="22" x2="24" y2="190" stroke="#bfd0d8" stroke-width="2" />${dots}</svg>`;
    } else {
      const slot = 520 / Math.max(points.length, 1);
      const bars = points.map((point, index) => { const height = Math.max((point.value / max) * 150, 4); const x = 30 + index * slot; const y = 190 - height; const width = Math.max(slot - 20, 18); const boxY = chart.type === "box" ? y + 30 : y; const boxH = chart.type === "box" ? Math.max(height - 30, 6) : height; return `<rect x="${x}" y="${boxY}" width="${width}" height="${boxH}" rx="10" fill="${palette[index % palette.length]}" opacity="0.88" /><text x="${x + width / 2}" y="208" text-anchor="middle" font-size="11" fill="#14303d">${safe(String(point.label).slice(0, 10))}</text>`; }).join("");
      graphic = `<svg viewBox="0 0 520 250" xmlns="http://www.w3.org/2000/svg"><rect width="520" height="250" fill="#fff" rx="18" /><line x1="24" y1="190" x2="500" y2="190" stroke="#bfd0d8" stroke-width="2" />${bars}</svg>`;
    }
    return `<article class="chart-print-card"><div class="print-card-head"><h3>${safe(chart.title)}</h3><span>${safe(chart.type)}</span></div>${graphic}</article>`;
  }).join("") || "<p>No visualizations generated yet.</p>";
  const cleaningRows = cleaning ? Object.entries(cleaning).filter(([key]) => key !== "header_map").map(([key, value]) => `<tr><td>${safe(toTitle(key))}</td><td>${safe(typeof value === "object" ? JSON.stringify(value) : String(value))}</td></tr>`).join("") : "<tr><td colspan='2'>No cleaning run yet</td></tr>";
  const missingRows = eda?.missing_values ? Object.entries(eda.missing_values).map(([key, value]) => `<tr><td>${safe(key)}</td><td>${value}</td><td>${eda.missing_percent?.[key] ?? 0}%</td></tr>`).join("") : "<tr><td colspan='3'>No EDA generated yet</td></tr>";
  const trainingRows = training ? Object.entries(training.metrics || {}).map(([key, value]) => `<tr><td>${safe(toTitle(key))}</td><td>${safe(typeof value === "object" ? JSON.stringify(value) : String(value))}</td></tr>`).join("") : "<tr><td colspan='2'>No model training yet</td></tr>";
  const featureRows = training?.top_features?.length ? training.top_features.map((item, index) => `<tr><td>${index + 1}</td><td>${safe(item.name)}</td><td>${item.importance}</td></tr>`).join("") : "<tr><td colspan='3'>No ranked features available</td></tr>";
  const historyRows = history?.length ? history.map((item) => `<tr><td>${safe(item.title)}</td><td>${safe(toTitle(item.run_type))}</td><td>${safe(item.dataset_name)}</td><td>${safe(new Date(item.created_at).toLocaleString())}</td></tr>`).join("") : "<tr><td colspan='4'>No history yet</td></tr>";
  const datasetRows = datasets?.length ? datasets.map((item) => `<tr><td>${safe(item.name)}</td><td>${item.row_count}</td><td>${item.column_count}</td><td>${safe(item.target_column || "-")}</td></tr>`).join("") : "<tr><td colspan='4'>No datasets uploaded</td></tr>";
  const previewHead = preview?.columns?.length ? preview.columns.map((column) => `<th>${safe(column)}</th>`).join("") : "<th>Preview</th>";
  const previewRows = preview?.rows?.length ? preview.rows.slice(0, 8).map((row) => `<tr>${preview.columns.map((column) => `<td>${safe(row[column] ?? "")}</td>`).join("")}</tr>`).join("") : "<tr><td>No preview available</td></tr>";
  popup.document.write(`<!doctype html><html><head><title>${safe(project?.name || "Data Forge Dashboard Report")}</title><style>body{font-family:Arial,sans-serif;margin:28px;color:#14303d;background:#fffdfa}.hero{padding:22px 24px;border-radius:24px;background:linear-gradient(135deg,#e8fff7,#eef4ff 55%,#fff3e8);margin-bottom:20px}.hero h1{margin:0 0 8px;font-size:32px}.hero p{margin:6px 0;color:#577082}.metrics,.grid,.chart-grid{display:grid;gap:16px}.metrics{grid-template-columns:repeat(4,minmax(0,1fr));margin-bottom:18px}.grid{grid-template-columns:repeat(2,minmax(0,1fr));margin-bottom:18px}.chart-grid{grid-template-columns:repeat(2,minmax(0,1fr));margin-bottom:18px}.metric,.card,.chart-print-card{border:1px solid #d9e4e9;border-radius:18px;padding:16px;background:#fff;break-inside:avoid}.metric strong{display:block;color:#577082;font-size:12px;text-transform:uppercase;letter-spacing:.08em}.metric div{font-size:28px;margin-top:10px;font-weight:700}.print-card-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px}.print-card-head h3{margin:0;font-size:16px}.print-card-head span{padding:6px 10px;border-radius:999px;background:#eff6ff;color:#1d4ed8;font-size:12px;text-transform:capitalize}.chart-print-card svg{width:100%;height:auto;display:block}.print-pie-layout{display:grid;grid-template-columns:1.1fr .9fr;gap:16px;align-items:center}.print-legend{display:grid;gap:8px}.print-legend-item{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;padding:8px 10px;border-radius:12px;background:#f8fafc}.print-swatch{width:12px;height:12px;border-radius:999px;display:inline-block}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border-bottom:1px solid #e6edf2;text-align:left;padding:8px;vertical-align:top}@media print{body{margin:14px}}</style></head><body><div class='hero'><h1>${safe(project?.name || "Data Forge Dashboard")}</h1><p>${safe(project?.description || "Saved data science dashboard report")}</p><p>Exported at ${safe(new Date().toLocaleString())}</p></div><div class='metrics'><div class='metric'><strong>Datasets</strong><div>${datasets?.length || 0}</div></div><div class='metric'><strong>Rows</strong><div>${preview?.row_count || 0}</div></div><div class='metric'><strong>Columns</strong><div>${preview?.column_count || 0}</div></div><div class='metric'><strong>Train Split</strong><div>${training?.train_split_percentage || "Not run"}</div></div></div><div class='grid'><section class='card'><h2>Datasets</h2><table><thead><tr><th>Name</th><th>Rows</th><th>Columns</th><th>Target</th></tr></thead><tbody>${datasetRows}</tbody></table></section><section class='card'><h2>Cleaning Summary</h2><table><tbody>${cleaningRows}</tbody></table></section><section class='card'><h2>EDA Summary</h2><p>Rows: ${eda?.shape?.rows || 0}</p><p>Columns: ${eda?.shape?.columns || 0}</p><p>Duplicate rows: ${eda?.duplicate_rows || 0}</p><table><thead><tr><th>Column</th><th>Missing</th><th>Missing %</th></tr></thead><tbody>${missingRows}</tbody></table></section><section class='card'><h2>ML Summary</h2><p>Model: ${safe(training?.model_type || "Not trained")}</p><p>Target: ${safe(training?.target_column || "-")}</p><p>Train rows: ${training?.train_rows || 0}</p><p>Test rows: ${training?.test_rows || 0}</p><p>Score: ${safe(training?.score ?? "-")}</p><table><tbody>${trainingRows}</tbody></table><h3>Top Features</h3><table><thead><tr><th>#</th><th>Feature</th><th>Importance</th></tr></thead><tbody>${featureRows}</tbody></table></section></div><section class='card' style='margin-bottom:18px;'><h2>Visualizations</h2><div class='chart-grid'>${chartMarkup}</div></section><div class='grid'><section class='card'><h2>Dataset Preview</h2><table><thead><tr>${previewHead}</tr></thead><tbody>${previewRows}</tbody></table></section><section class='card'><h2>Process History</h2><table><thead><tr><th>Title</th><th>Type</th><th>Dataset</th><th>Created</th></tr></thead><tbody>${historyRows}</tbody></table></section></div><script>window.onload=()=>setTimeout(()=>window.print(),350);</script></body></html>`);
  popup.document.close();
}

export function WorkbenchPage({ user, onLogout }) {
  const [activeView, setActiveView] = useState(() => localStorage.getItem(VIEW_KEY) || "overview");
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(() => {
    const saved = localStorage.getItem(PROJECT_KEY);
    return saved ? Number(saved) : null;
  });
  const [datasets, setDatasets] = useState([]);
  const [history, setHistory] = useState([]);
  const [activeDatasetId, setActiveDatasetId] = useState(null);
  const [preview, setPreview] = useState(null);
  const [eda, setEda] = useState(null);
  const [visuals, setVisuals] = useState([]);
  const [dashboardVisuals, setDashboardVisuals] = useState([]);
  const [training, setTraining] = useState(null);
  const [cleaningSummary, setCleaningSummary] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [cleaningForm, setCleaningForm] = useState({ drop_columns: [], fill_missing: "median", fill_categorical: "mode", remove_duplicates: true, trim_whitespace: true, normalize_headers: false, text_case: "none", drop_missing_rows: false, drop_empty_columns: false, drop_constant_columns: false, remove_outliers: false, cap_outliers: false, outlier_column: "", convert_column: "", convert_type: "number", round_numeric: false, round_digits: 2, target_column: "" });
  const [visualForm, setVisualForm] = useState({ x_axis: "", y_axis: "", color_by: "", chart_type: "bar" });
  const [trainingForm, setTrainingForm] = useState({ target_column: "", feature_columns: [], model_type: "auto", train_split_percent: 80 });

  useEffect(() => {
    localStorage.setItem(VIEW_KEY, activeView);
  }, [activeView]);

  useEffect(() => {
    if (activeProjectId) {
      localStorage.setItem(PROJECT_KEY, String(activeProjectId));
    }
  }, [activeProjectId]);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (activeProjectId) {
      loadProjectData(activeProjectId);
      try {
        const saved = localStorage.getItem(getDashboardVisualStorageKey(activeProjectId));
        setDashboardVisuals(saved ? JSON.parse(saved) : []);
      } catch {
        setDashboardVisuals([]);
      }
    } else {
      setDashboardVisuals([]);
    }
  }, [activeProjectId]);

  useEffect(() => {
    if (!activeProjectId) return;
    localStorage.setItem(getDashboardVisualStorageKey(activeProjectId), JSON.stringify(dashboardVisuals));
  }, [activeProjectId, dashboardVisuals]);

  useEffect(() => {
    if (activeProjectId && activeDatasetId) {
      loadPreview(activeProjectId, activeDatasetId);
    }
  }, [activeProjectId, activeDatasetId]);

  async function loadProjects() {
    try {
      const list = await api.listProjects();
      if (!list.length) {
        const starter = await api.createProject({ name: "Starter Project", description: "Auto-created project for your first upload" });
        setProjects([starter]);
        setActiveProjectId(starter.id);
        setMessage("Starter project created. You can upload data now.");
        return;
      }
      setProjects(list);
      const savedProject = localStorage.getItem(PROJECT_KEY);
      const matched = savedProject ? list.find((project) => project.id === Number(savedProject)) : null;
      setActiveProjectId((current) => current || matched?.id || list[0].id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadProjectData(projectId) {
    try {
      const [datasetList, dashboardData, historyData] = await Promise.all([api.listDatasets(projectId), api.getDashboard(projectId), api.getHistory(projectId)]);
      setDatasets(datasetList);
      setVisuals(dashboardData.latest_visualizations || []);
      setTraining(dashboardData.latest_training || null);
      setEda(dashboardData.latest_eda || null);
      setCleaningSummary(dashboardData.latest_cleaning || null);
      setHistory(historyData.history || []);
      setActiveDatasetId((current) => (datasetList.some((dataset) => dataset.id === current) ? current : datasetList[0]?.id || null));
      if (!datasetList.length) {
        setPreview(null);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadPreview(projectId, datasetId) {
    try {
      const data = await api.previewDataset(projectId, datasetId);
      setPreview(data);
      setCleaningForm((current) => ({ ...current, target_column: current.target_column || data.columns[0] || "", outlier_column: current.outlier_column || data.columns[0] || "", convert_column: current.convert_column || data.columns[0] || "" }));
      setTrainingForm((current) => {
        const nextTarget = current.target_column || data.columns[0] || "";
        const validFeatures = (current.feature_columns || []).filter((column) => data.columns.includes(column) && column !== nextTarget);
        return { ...current, target_column: nextTarget, feature_columns: validFeatures.length ? validFeatures : data.columns.filter((column) => column !== nextTarget) };
      });
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleProjectCreate() {
    setError("");
    try {
      const name = `Project ${projects.length + 1}`;
      const description = `Saved workspace created on ${new Date().toLocaleDateString()}`;
      const project = await api.createProject({ name, description });
      setProjects((current) => [project, ...current]);
      setActiveProjectId(project.id);
      setActiveView("overview");
      setMessage("Project created successfully.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleProjectDelete(projectId = activeProjectId) {
    if (!projectId) return;
    setError("");
    try {
      await api.deleteProject(projectId);
      const remaining = projects.filter((project) => project.id !== projectId);
      setProjects(remaining);
      setActiveProjectId(remaining[0]?.id || null);
      setActiveDatasetId(null);
      setPreview(null);
      setHistory([]);
      setCleaningSummary(null);
      setEda(null);
      setTraining(null);
      setVisuals([]);
      localStorage.removeItem(getDashboardVisualStorageKey(projectId));
      setDashboardVisuals([]);
      setMessage("Project deleted successfully.");
      if (!remaining.length) {
        await loadProjects();
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDatasetUpload(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const fileInput = form.elements.dataset;
    setError("");
    setMessage("");
    if (!activeProjectId) {
      setError("Create or select a project before uploading data.");
      return;
    }
    const file = fileInput?.files?.[0];
    if (!file) {
      setError("Choose a CSV or Excel file first.");
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    setUploading(true);
    try {
      const dataset = await api.uploadDataset(activeProjectId, formData);
      setMessage(`${dataset.name} uploaded and saved.`);
      setSelectedFileName(file.name);
      await loadProjectData(activeProjectId);
      setActiveDatasetId(dataset.id);
      setActiveView("overview");
      form.reset();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function executeClean(nextForm) {
    await api.cleanDataset(activeProjectId, activeDatasetId, { drop_columns: nextForm.drop_columns, fill_missing: nextForm.fill_missing, fill_categorical: nextForm.fill_categorical, remove_duplicates: nextForm.remove_duplicates, trim_whitespace: nextForm.trim_whitespace, normalize_headers: nextForm.normalize_headers, text_case: nextForm.text_case, drop_missing_rows: nextForm.drop_missing_rows, drop_empty_columns: nextForm.drop_empty_columns, drop_constant_columns: nextForm.drop_constant_columns, remove_outliers: nextForm.remove_outliers, cap_outliers: nextForm.cap_outliers, outlier_column: nextForm.outlier_column || null, convert_column: nextForm.convert_column || null, convert_type: nextForm.convert_type || null, round_numeric: nextForm.round_numeric, round_digits: Number(nextForm.round_digits || 2), target_column: nextForm.target_column || null });
    await loadProjectData(activeProjectId);
    await loadPreview(activeProjectId, activeDatasetId);
    setEda(await api.getEda(activeProjectId, activeDatasetId));
  }

  async function handleClean() {
    setError("");
    try {
      await executeClean(cleaningForm);
      setMessage("Cleaning completed and dataset updated.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function runQuickClean(partial, successMessage) {
    setError("");
    try {
      const nextForm = { ...cleaningForm, ...partial };
      setCleaningForm(nextForm);
      await executeClean(nextForm);
      setMessage(successMessage);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleEda() {
    setError("");
    try {
      setEda(await api.getEda(activeProjectId, activeDatasetId));
      setMessage("EDA summary generated.");
      await loadProjectData(activeProjectId);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleVisualize() {
    setError("");
    try {
      const result = await api.getVisualizations(activeProjectId, activeDatasetId, { chart_types: [visualForm.chart_type], x_axis: visualForm.x_axis || null, y_axis: visualForm.y_axis || null, color_by: visualForm.color_by || null });
      setVisuals(result.charts);
      setMessage(`${visualForm.chart_type} visualization generated.`);
      await loadProjectData(activeProjectId);
    } catch (err) {
      setError(err.message);
    }
  }

  function isChartSavedToDashboard(chart) {
    return dashboardVisuals.some((savedChart) => getChartSignature(savedChart) === getChartSignature(chart));
  }

  function handleAddChartToDashboard(chart) {
    if (isChartSavedToDashboard(chart)) {
      setMessage("This chart is already saved in the dashboard.");
      return;
    }
    setDashboardVisuals((current) => [...current, chart]);
    setMessage(`${chart.title} added to the dashboard.`);
  }

  function handleRemoveChartFromDashboard(chart) {
    setDashboardVisuals((current) => current.filter((savedChart) => getChartSignature(savedChart) !== getChartSignature(chart)));
    setMessage(`${chart.title} removed from the dashboard.`);
  }

  async function handleTrain() {
    setError("");
    try {
      const result = await api.trainModel(activeProjectId, activeDatasetId, { target_column: trainingForm.target_column, model_type: trainingForm.model_type, train_split: Number(trainingForm.train_split_percent) / 100 });
      setTraining(result);
      setMessage("Training completed and dashboard metrics updated.");
      await loadProjectData(activeProjectId);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDatasetDownload() {
    try {
      const blob = await api.downloadDataset(activeProjectId, activeDatasetId);
      downloadBlob(blob, datasets.find((dataset) => dataset.id === activeDatasetId)?.name || "dataset.csv");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDashboardExport() {
    try {
      printDashboardPdf({ project: projects.find((project) => project.id === activeProjectId) || null, datasets, preview, cleaning: cleaningSummary, eda, visuals: dashboardVisuals.length ? dashboardVisuals : visuals, training, history });
      setMessage("Print dialog opened. Save it as PDF from the print window.");
    } catch (err) {
      setError(err.message);
    }
  }

  const columns = useMemo(() => preview?.columns || [], [preview]);
  const inferredTypes = useMemo(() => {
    const result = {};
    (preview?.columns || []).forEach((column) => {
      const values = (preview?.rows || []).map((row) => row[column]).filter((value) => value !== "" && value !== null && value !== undefined);
      if (!values.length) {
        result[column] = "unknown";
        return;
      }
      const isNumeric = values.every((value) => !Number.isNaN(Number(value)));
      const isDate = !isNumeric && values.every((value) => !Number.isNaN(Date.parse(value)));
      result[column] = isNumeric ? "numeric" : isDate ? "date" : "text";
    });
    return result;
  }, [preview]);
  const numericColumns = useMemo(() => (preview?.columns || []).filter((column) => {
    const dtype = eda?.dtypes?.[column] || inferredTypes[column];
    return String(dtype || "").includes("int") || String(dtype || "").includes("float") || dtype === "numeric";
  }), [preview, eda, inferredTypes]);
  const columnProfiles = useMemo(() => columns.map((column) => ({
    name: column,
    type: eda?.dtypes?.[column] || inferredTypes[column] || "unknown",
    missing: eda?.missing_values?.[column] ?? 0,
    missingPercent: eda?.missing_percent?.[column] ?? 0,
    unique: eda?.unique_counts?.[column] ?? new Set((preview?.rows || []).map((row) => row[column]).filter((value) => value !== "" && value !== null && value !== undefined)).size,
    sample: (preview?.rows || []).map((row) => row[column]).find((value) => value !== "" && value !== null && value !== undefined) ?? "-",
  })), [columns, eda, inferredTypes, preview]);
  const activeProject = projects.find((project) => project.id === activeProjectId) || null;
  const availableFeatureColumns = useMemo(() => columns.filter((column) => column !== trainingForm.target_column), [columns, trainingForm.target_column]);

  function renderDescribeTable() {
    if (!eda?.describe || !Object.keys(eda.describe).length) {
      return <p className="empty-state">No numeric summary available yet.</p>;
    }
    const stats = Object.keys(eda.describe);
    const metrics = Object.keys(eda.describe[stats[0]] || {});
    return <div className="table-shell"><table><thead><tr><th>Metric</th>{stats.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{metrics.map((metric) => <tr key={metric}><td>{metric}</td>{stats.map((column) => <td key={`${column}-${metric}`}>{String(eda.describe[column]?.[metric] ?? "")}</td>)}</tr>)}</tbody></table></div>;
  }

  function renderEdaDetails() {
    if (!eda) {
      return <p className="empty-state">Run EDA to generate the full analysis details.</p>;
    }
    return <div className="eda-grid"><article className="panel"><h3>Shape and types</h3><div className="info-block"><p>Rows: {eda.shape.rows}</p><p>Columns: {eda.shape.columns}</p></div><div className="table-shell"><table><thead><tr><th>Column</th><th>Type</th><th>Missing</th></tr></thead><tbody>{eda.columns.map((column) => <tr key={column}><td>{column}</td><td>{eda.dtypes[column]}</td><td>{eda.missing_values[column] ?? 0}</td></tr>)}</tbody></table></div></article><article className="panel"><h3>Numeric summary</h3>{renderDescribeTable()}</article><article className="panel"><h3>Correlations</h3>{Object.keys(eda.correlations || {}).length ? <div className="table-shell"><table><thead><tr><th>Column</th>{Object.keys(eda.correlations).map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{Object.keys(eda.correlations).map((rowKey) => <tr key={rowKey}><td>{rowKey}</td>{Object.keys(eda.correlations).map((column) => <td key={`${rowKey}-${column}`}>{String(eda.correlations[rowKey]?.[column] ?? "")}</td>)}</tr>)}</tbody></table></div> : <p className="empty-state">Not enough numeric columns for correlation.</p>}</article><article className="panel"><h3>Categorical summary</h3>{Object.keys(eda.categorical_summary || {}).length ? Object.entries(eda.categorical_summary).map(([column, values]) => <div key={column} className="summary-block"><strong>{column}</strong><div className="mini-table">{Object.entries(values).map(([label, count]) => <div key={`${column}-${label}`}><span>{label}</span><b>{count}</b></div>)}</div></div>) : <p className="empty-state">No categorical summary available.</p>}</article></div>;
  }

  function renderProjectsView() {
    return <section className="workspace-single"><article className="panel"><div className="section-header"><div><h3>Project workspace</h3><p className="section-copy">Open any project directly into its dashboard. Delete old projects from the right side of each row.</p></div><button type="button" onClick={handleProjectCreate}>Create new project</button></div><div className="project-list project-list-large">{projects.map((project) => <div key={project.id} className={project.id === activeProjectId ? "project-row active" : "project-row"}><button type="button" className="project-main" onClick={() => { setActiveProjectId(project.id); setActiveView("overview"); }}><strong>{project.name}</strong><span>{project.description || "No description"}</span></button><button type="button" className="project-delete" onClick={() => handleProjectDelete(project.id)}>Delete</button></div>)}</div></article></section>;
  }

  function renderPreviewView() {
    return <section className="workspace-single"><article className="panel"><div className="section-header"><div><h3>Data preview</h3><p className="section-copy">Review rows, columns, and structure before cleaning, EDA, or ML training.</p></div><button type="button" onClick={handleDatasetDownload} disabled={!activeDatasetId}>Download current dataset</button></div><section className="metrics-grid preview-metrics"><MetricCard label="Rows" value={preview?.row_count || 0} helper="Observed rows" /><MetricCard label="Columns" value={preview?.column_count || 0} helper="Detected columns" /><MetricCard label="Numeric" value={numericColumns.length} helper="Numeric candidates" /><MetricCard label="Target" value={trainingForm.target_column || "-"} helper="Selected target" /></section>{preview?.rows?.length ? <div className="table-shell"><table><thead><tr>{preview.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{preview.rows.map((row, index) => <tr key={index}>{preview.columns.map((column) => <td key={`${index}-${column}`}>{String(row[column] ?? "")}</td>)}</tr>)}</tbody></table></div> : <p className="empty-state">Upload a dataset to see the preview.</p>}</article></section>;
  }

  function renderOverview() {
    const showingSavedCharts = dashboardVisuals.length > 0;
    const overviewCharts = showingSavedCharts ? dashboardVisuals : visuals;
    return <>
      <section className="dashboard-hero panel panel-hero"><div><p className="eyebrow">Executive Dashboard</p><h2>{activeProject?.name || "Project dashboard"}</h2><p>{activeProject?.description || "Track ingestion, cleaning, EDA, visualizations, model training, and history from one dashboard."}</p></div><div className="dashboard-actions"><button type="button" onClick={() => setActiveView("ingest")}>Add dataset</button><button type="button" onClick={() => setActiveView("ml")} disabled={!activeDatasetId}>Run training</button></div></section>
      <section className="metrics-grid dashboard-metrics-grid">
        <MetricCard label="Datasets" value={datasets.length} helper="Saved for this project" />
        <MetricCard label="Rows" value={preview?.row_count || 0} helper="Current dataset rows" />
        <MetricCard label="Saved Charts" value={dashboardVisuals.length} helper="Pinned into dashboard" />
        <MetricCard label="Train Split" value={training ? `${training.train_split_percentage}%` : `${trainingForm.train_split_percent}%`} helper={training?.train_test_ratio || `Ratio ${Number(trainingForm.train_split_percent) / 100}:${(1 - Number(trainingForm.train_split_percent) / 100).toFixed(2)}`} />
      </section>
      <section className="dashboard-grid dashboard-grid-3">
        <article className="panel"><h3>Cleaning Status</h3>{cleaningSummary ? <div className="info-block"><p>Rows before: {cleaningSummary.rows_before}</p><p>Rows after: {cleaningSummary.rows_after}</p><p>Dropped columns: {(cleaningSummary.dropped_columns || []).join(", ") || "None"}</p><p>Missing after cleaning: {cleaningSummary.missing_after}</p><p>Duplicates removed: {cleaningSummary.duplicates_removed}</p><p>Outliers removed: {cleaningSummary.outliers_removed}</p><p>Conversion: {cleaningSummary.conversion?.target_type || "Not used"}</p></div> : <p className="empty-state">No cleaning run yet.</p>}</article>
        <article className="panel"><h3>EDA Snapshot</h3>{eda ? <div className="info-block"><p>Rows: {eda.shape.rows}</p><p>Columns: {eda.shape.columns}</p><p>Missing tracked: {Object.values(eda.missing_values || {}).reduce((sum, value) => sum + Number(value || 0), 0)}</p><p>Duplicate rows: {eda.duplicate_rows ?? 0}</p><p>Correlation matrix: {Object.keys(eda.correlations || {}).length ? "Available" : "Not enough numeric columns"}</p></div> : <p className="empty-state">No EDA summary yet.</p>}</article>
        <article className="panel"><h3>ML Training</h3>{training ? <div className="info-block"><p>Model: {training.model_type}</p><p>Selection: {toTitle(training.selected_model_key || training.requested_model_type || "auto")}</p><p>Target: {training.target_column}</p><p>Train split: {training.train_split_percentage}%</p><p>Ratio: {training.train_test_ratio}</p><p>Train rows: {training.train_rows}</p><p>Test rows: {training.test_rows}</p><p>Train score: {training.train_score}</p><p>Test score: {training.test_score}</p></div> : <p className="empty-state">No model trained yet.</p>}</article>
      </section>
      <section className="panel"><div className="section-header"><div><h3>Dashboard Visualizations</h3><p className="section-copy">{showingSavedCharts ? "These charts are pinned to the dashboard and will also be used in PDF export." : "These are the latest generated charts. Add the ones you want to keep in the dashboard."}</p></div><button type="button" className="secondary-btn" onClick={() => setActiveView("viz")}>Open Visualization Studio</button></div><div className="chart-grid chart-grid-spacious">{overviewCharts.length ? overviewCharts.map((chart, index) => <ChartPreview key={`${chart.type}-${chart.title}-${index}`} chart={chart} compact action={showingSavedCharts ? <button type="button" className="danger-link" onClick={() => handleRemoveChartFromDashboard(chart)}>Delete from Dashboard</button> : <button type="button" onClick={() => handleAddChartToDashboard(chart)} disabled={isChartSavedToDashboard(chart)}>{isChartSavedToDashboard(chart) ? "Already Added" : "Add to Dashboard"}</button>} />) : <p className="empty-state">Charts added from visualization will appear here.</p>}</div></section>
      <section className="dashboard-grid">
        <article className="panel"><h3>Recent Projects</h3><div className="project-list">{projects.slice(0, 5).map((project) => <div key={project.id} className={project.id === activeProjectId ? "project-row active" : "project-row"}><button type="button" className="project-main" onClick={() => { setActiveProjectId(project.id); setActiveView("overview"); }}><strong>{project.name}</strong><span>{project.description || "No description"}</span></button><button type="button" className="project-delete" onClick={() => handleProjectDelete(project.id)}>Delete</button></div>)}</div></article>
        <article className="panel"><h3>Process Timeline</h3><div className="history-list">{history.length ? history.slice(0, 6).map((item) => <article key={item.id} className="history-card"><strong>{item.title}</strong><span>{toPretty(item.run_type)} on {item.dataset_name}</span><small>{new Date(item.created_at).toLocaleString()}</small></article>) : <p className="empty-state">No process history yet.</p>}</div></article>
      </section>
      <section className="panel"><h3>Dataset Preview</h3>{preview?.rows?.length ? <div className="table-shell"><table><thead><tr>{preview.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{preview.rows.map((row, index) => <tr key={index}>{preview.columns.map((column) => <td key={`${index}-${column}`}>{String(row[column] ?? "")}</td>)}</tr>)}</tbody></table></div> : <p className="empty-state">Upload a dataset to preview it here.</p>}</section>
    </>;
  }

  function renderIngest() {
    return <section className="workspace-single"><article className="panel"><h3>Upload dataset</h3><p className="section-copy">Choose a CSV or Excel file. Invalid files are rejected and will not be saved into project history.</p><form className="upload-form" onSubmit={handleDatasetUpload}><input name="dataset" type="file" accept=".csv,.xlsx,.xls" onChange={(e) => setSelectedFileName(e.target.files?.[0]?.name || "")} /><div className="upload-summary"><span>{selectedFileName || "No file selected yet"}</span><span>{activeProjectId ? `Project #${activeProjectId} selected` : "No project selected"}</span></div><button type="submit" disabled={!activeProjectId || uploading}>{uploading ? "Uploading..." : "Upload dataset"}</button></form></article></section>;
  }

  function renderClean() {
return <section className="workspace-single"><section className="metrics-grid clean-stats-grid"><MetricCard label="Total Rows" value={preview?.row_count || 0} helper="Current working rows" /><MetricCard label="Columns" value={preview?.column_count || 0} helper="Available fields" /><MetricCard label="Missing Values" value={eda ? Object.values(eda.missing_values || {}).reduce((sum, count) => sum + count, 0) : 0} helper="Across all columns" /><MetricCard label="Duplicates" value={eda?.duplicate_rows ?? 0} helper="Rows repeated exactly" /></section><div className="clean-layout"><article className="panel"><div className="panel-section-header"><h3>Cleaning Operations</h3><button type="button" onClick={handleClean} disabled={!activeDatasetId}>Run Full Pipeline</button></div><div className="clean-op-list"><div className="clean-op-row"><div><strong>Drop duplicate rows</strong><p>Remove rows with identical values across all columns.</p></div><button type="button" className="secondary-btn" onClick={() => runQuickClean({ remove_duplicates: true }, "Duplicate rows removed.")}>Run</button></div><div className="clean-op-row"><div><strong>Handle missing values</strong><p>Fill or drop null, blank, and missing values.</p></div><div className="clean-op-actions"><select className="inline-control" value={cleaningForm.fill_missing} onChange={(e) => setCleaningForm({ ...cleaningForm, fill_missing: e.target.value })}><option value="mean">Fill mean</option><option value="median">Fill median</option><option value="mode">Fill mode</option><option value="zero">Fill zero</option></select><button type="button" className="secondary-btn" onClick={() => runQuickClean({ fill_missing: cleaningForm.fill_missing }, `Missing values handled using ${cleaningForm.fill_missing}.`)}>Apply</button></div></div><div className="clean-op-row"><div><strong>Trim whitespace</strong><p>Strip leading and trailing spaces from text columns.</p></div><button type="button" className="secondary-btn" onClick={() => runQuickClean({ trim_whitespace: true }, "Whitespace trimmed from text columns.")}>Run</button></div><div className="clean-op-row"><div><strong>Normalize column names</strong><p>Convert headers into lowercase snake_case names.</p></div><button type="button" className="secondary-btn" onClick={() => runQuickClean({ normalize_headers: true }, "Column names normalized.")}>Run</button></div><div className="clean-op-row"><div><strong>Drop column</strong><p>Remove a specific column from the dataset.</p></div><div className="clean-op-actions"><select className="inline-control" value={cleaningForm.drop_columns[0] || ""} onChange={(e) => setCleaningForm({ ...cleaningForm, drop_columns: e.target.value ? [e.target.value] : [] })}><option value="">Select column</option>{columns.map((column) => <option key={column} value={column}>{column}</option>)}</select><button type="button" className="danger-link" onClick={() => cleaningForm.drop_columns[0] ? runQuickClean({ drop_columns: cleaningForm.drop_columns }, `${cleaningForm.drop_columns[0]} dropped from dataset.`) : setError("Select a column to drop.")}>Drop</button></div></div><div className="clean-op-row"><div><strong>Remove outliers (IQR)</strong><p>Drop rows beyond 1.5 × IQR for numeric columns.</p></div><div className="clean-op-actions"><select className="inline-control" value={cleaningForm.outlier_column} onChange={(e) => setCleaningForm({ ...cleaningForm, outlier_column: e.target.value })}><option value="">Select numeric column</option>{numericColumns.map((column) => <option key={column} value={column}>{column}</option>)}</select><button type="button" className="secondary-btn" onClick={() => cleaningForm.outlier_column ? runQuickClean({ remove_outliers: true, cap_outliers: false, outlier_column: cleaningForm.outlier_column }, `Outliers removed from ${cleaningForm.outlier_column}.`) : setError("Select a numeric column for outlier removal.")}>Apply</button></div></div><div className="clean-op-row"><div><strong>Type conversion</strong><p>Convert a selected column to number, text, or date.</p></div><div className="clean-op-actions clean-op-actions-wide"><select className="inline-control" value={cleaningForm.convert_column} onChange={(e) => setCleaningForm({ ...cleaningForm, convert_column: e.target.value })}><option value="">Select column</option>{columns.map((column) => <option key={column} value={column}>{column}</option>)}</select><select className="inline-control" value={cleaningForm.convert_type} onChange={(e) => setCleaningForm({ ...cleaningForm, convert_type: e.target.value })}><option value="number">To Number</option><option value="string">To Text</option><option value="date">To Date</option></select><button type="button" className="secondary-btn" onClick={() => cleaningForm.convert_column ? runQuickClean({ convert_column: cleaningForm.convert_column, convert_type: cleaningForm.convert_type }, `${cleaningForm.convert_column} converted to ${cleaningForm.convert_type}.`) : setError("Select a column for type conversion.")}>Go</button></div></div></div>{cleaningSummary ? <article className="panel inner-panel clean-result-card"><h4>Last Cleaning Result</h4><div className="detail-grid"><div><span>Rows before</span><b>{cleaningSummary.rows_before}</b></div><div><span>Rows after</span><b>{cleaningSummary.rows_after}</b></div><div><span>Missing after</span><b>{cleaningSummary.missing_after}</b></div><div><span>Duplicates removed</span><b>{cleaningSummary.duplicates_removed}</b></div><div><span>Outliers removed</span><b>{cleaningSummary.outliers_removed}</b></div><div><span>Conversion</span><b>{cleaningSummary.conversion?.target_type || "Not used"}</b></div></div></article> : null}</article><article className="panel"><div className="panel-section-header"><h3>Column Profiles</h3><button type="button" className="secondary-btn" onClick={handleEda} disabled={!activeDatasetId}>Refresh Profiles</button></div><div className="column-profile-list">{columnProfiles.length ? columnProfiles.map((profile) => <article key={profile.name} className="column-profile-card"><div className="column-profile-head"><div><h4>{profile.name}</h4><span className={`type-badge ${String(profile.type).includes("int") || String(profile.type).includes("float") || profile.type === "numeric" ? "type-badge-numeric" : String(profile.type).includes("date") || profile.type === "date" ? "type-badge-date" : String(profile.type) === "unknown" ? "type-badge-unknown" : "type-badge-text"}`}>{String(profile.type).includes("int") || String(profile.type).includes("float") ? "numeric" : String(profile.type).includes("date") ? "date" : profile.type}</span></div></div><div className="column-profile-stats"><div><span>{String(profile.type).includes("int") || String(profile.type).includes("float") || profile.type === "numeric" ? "Mean-ready" : "Unique"}</span><b>{String(profile.type).includes("int") || String(profile.type).includes("float") || profile.type === "numeric" ? "Yes" : profile.unique}</b></div><div><span>Sample</span><b>{String(profile.sample).slice(0, 18)}</b></div></div><p className="column-profile-missing">Missing: {profile.missing} ({profile.missingPercent}%)</p><div className="profile-progress"><div className="profile-progress-fill" style={{ width: `${Math.max(4, 100 - Number(profile.missingPercent || 0))}%` }} /></div></article>) : <p className="empty-state">Upload and profile a dataset to see column details.</p>}</div></article></div></section>;
}

  function renderEda() {
    return <section className="workspace-single"><article className="panel"><div className="section-header"><h3>EDA details</h3><button type="button" onClick={handleEda} disabled={!activeDatasetId}>Generate EDA</button></div>{renderEdaDetails()}</article></section>;
  }

  function renderViz() {
    const activeChartType = visualForm.chart_type;
    const canUseYAxis = ["bar", "line", "scatter", "histogram", "box"].includes(activeChartType);
    const canUseColor = ["scatter", "bar", "pie"].includes(activeChartType);
    return <section className="workspace-single"><article className="panel"><div className="section-header"><div><h3>Visualization Studio</h3><p className="section-copy">Choose one chart type, configure the fields that matter for that chart, generate it, then add it to your dashboard if you want to keep it.</p></div><button type="button" onClick={handleVisualize} disabled={!activeDatasetId}>{`Generate ${visualForm.chart_type}`}</button></div><div className="viz-layout"><section className="panel inner-panel"><h4>Chart Builder</h4><div className="form-grid-2"><div><label>Chart type</label><select value={visualForm.chart_type} onChange={(e) => setVisualForm({ ...visualForm, chart_type: e.target.value })}>{chartTypes.map((type) => <option key={type} value={type}>{toTitle(type)}</option>)}</select></div><div><label>X axis</label><select value={visualForm.x_axis} onChange={(e) => setVisualForm({ ...visualForm, x_axis: e.target.value })}><option value="">Auto</option>{columns.map((column) => <option key={column} value={column}>{column}</option>)}</select></div>{canUseYAxis ? <div><label>{activeChartType === "histogram" ? "Value column" : "Y axis"}</label><select value={visualForm.y_axis} onChange={(e) => setVisualForm({ ...visualForm, y_axis: e.target.value })}><option value="">Auto</option>{columns.map((column) => <option key={column} value={column}>{column}</option>)}</select></div> : null}{canUseColor ? <div><label>{activeChartType === "pie" ? "Slice grouping" : "Color by"}</label><select value={visualForm.color_by} onChange={(e) => setVisualForm({ ...visualForm, color_by: e.target.value })}><option value="">None</option>{columns.map((column) => <option key={column} value={column}>{column}</option>)}</select></div> : null}</div><div className="info-block note-block"><p>Chart guidance</p><p>Bar and line charts now aggregate repeated category names so brands do not repeat across the X-axis.</p><p>Pie works best with categorical columns.</p><p>Scatter works best with numeric X and numeric Y columns.</p></div></section><section className="panel inner-panel"><h4>Dashboard selections</h4><div className="history-list">{dashboardVisuals.length ? dashboardVisuals.map((chart, index) => <article key={`${chart.type}-${chart.title}-${index}`} className="history-card"><strong>{chart.title}</strong><span>{toTitle(chart.type)}</span><button type="button" className="danger-link" onClick={() => handleRemoveChartFromDashboard(chart)}>Remove</button></article>) : <p className="empty-state">No charts added yet. Generate a chart and add it to the dashboard.</p>}</div></section></div><div className="chart-grid chart-grid-spacious">{visuals.length ? visuals.map((chart, index) => <ChartPreview key={`${chart.type}-${index}`} chart={chart} action={<div className="chart-actions-row"><button type="button" onClick={() => handleAddChartToDashboard(chart)} disabled={isChartSavedToDashboard(chart)}>{isChartSavedToDashboard(chart) ? "Added" : "Add to Dashboard"}</button></div>} />) : <p className="empty-state">Generate a visualization to preview it here.</p>}</div></article></section>;
  }

  function renderMl() {
    const selectedFeatureCount = (trainingForm.feature_columns || []).length;
    return <section className="workspace-single"><article className="panel"><div className="section-header"><div><h3>ML training</h3><p className="section-copy">Choose the target, select feature columns, pick a model family, and set the training split. Auto mode compares multiple models and selects the strongest one.</p></div><button type="button" onClick={handleTrain} disabled={!activeDatasetId || !trainingForm.target_column || !selectedFeatureCount}>Train model</button></div><div className="form-grid-2"><div><label>Target column</label><select value={trainingForm.target_column} onChange={(e) => { const nextTarget = e.target.value; setTrainingForm({ ...trainingForm, target_column: nextTarget, feature_columns: columns.filter((column) => column !== nextTarget && ((trainingForm.feature_columns || []).includes(column) || !(trainingForm.feature_columns || []).length)) }); }}><option value="">Select target</option>{columns.map((column) => <option key={column} value={column}>{column}</option>)}</select></div><div><label>Model type</label><select value={trainingForm.model_type} onChange={(e) => setTrainingForm({ ...trainingForm, model_type: e.target.value })}><option value="auto">Auto compare best model</option><option value="xgboost">XGBoost</option><option value="random_forest">Random Forest</option><option value="extra_trees">Extra Trees</option><option value="linear">Linear / Logistic</option></select></div><div><label>Train split</label><input type="range" min="60" max="90" step="5" value={trainingForm.train_split_percent} onChange={(e) => setTrainingForm({ ...trainingForm, train_split_percent: e.target.value })} /><p className="section-copy">{trainingForm.train_split_percent}% train / {100 - Number(trainingForm.train_split_percent)}% test ({(Number(trainingForm.train_split_percent) / 100).toFixed(2)}:{(1 - Number(trainingForm.train_split_percent) / 100).toFixed(2)})</p></div></div><article className="panel inner-panel result-panel"><div className="section-header"><div><h4>Feature columns</h4><p className="section-copy">Select the columns to use as model inputs. The target column is automatically excluded.</p></div><div className="chart-actions-row"><button type="button" className="secondary-btn" onClick={() => setTrainingForm({ ...trainingForm, feature_columns: availableFeatureColumns })}>Select all</button><button type="button" className="secondary-btn" onClick={() => setTrainingForm({ ...trainingForm, feature_columns: [] })}>Clear</button></div></div><div className="toggle-grid">{availableFeatureColumns.length ? availableFeatureColumns.map((column) => <label key={column} className="toggle-card"><input type="checkbox" checked={(trainingForm.feature_columns || []).includes(column)} onChange={(e) => setTrainingForm({ ...trainingForm, feature_columns: e.target.checked ? [...(trainingForm.feature_columns || []), column] : (trainingForm.feature_columns || []).filter((item) => item !== column) })} /><span>{column}</span></label>) : <p className="empty-state">Upload a dataset and choose a target column to enable feature selection.</p>}</div><p className="section-copy">Selected features: {selectedFeatureCount}</p></article>{training ? <div className="training-grid"><article className="panel inner-panel"><h4>Training summary</h4><div className="detail-grid"><div><span>Model</span><b>{training.model_type}</b></div><div><span>Chosen family</span><b>{toTitle(training.selected_model_key || training.requested_model_type || "auto")}</b></div><div><span>Target</span><b>{training.target_column}</b></div><div><span>Problem type</span><b>{training.metrics?.problem_type}</b></div><div><span>Train split</span><b>{training.train_split_percentage}%</b></div><div><span>Ratio</span><b>{training.train_test_ratio}</b></div><div><span>Train rows</span><b>{training.train_rows}</b></div><div><span>Test rows</span><b>{training.test_rows}</b></div><div><span>Train score</span><b>{training.train_score}</b></div><div><span>Test score</span><b>{training.test_score}</b></div></div></article><article className="panel inner-panel"><h4>Dataset and features</h4><div className="detail-grid"><div><span>Total rows</span><b>{training.total_rows}</b></div><div><span>Feature count</span><b>{training.feature_count}</b></div><div><span>Numeric features</span><b>{training.numeric_feature_count}</b></div><div><span>Categorical features</span><b>{training.categorical_feature_count}</b></div></div><div className="summary-block"><strong>Selected feature columns</strong><p>{training.selected_feature_columns?.join(", ") || "All available non-target columns"}</p></div></article><article className="panel inner-panel"><h4>Metrics</h4><div className="mini-table">{Object.entries(training.metrics || {}).map(([key, value]) => <div key={key}><span>{toTitle(key)}</span><b>{typeof value === "object" ? JSON.stringify(value) : String(value)}</b></div>)}</div></article><article className="panel inner-panel training-full-span"><h4>Model comparison</h4>{training.model_leaderboard?.length ? <div className="table-shell"><table><thead><tr><th>Model</th><th>Train score</th><th>Test score</th></tr></thead><tbody>{training.model_leaderboard.map((item, index) => <tr key={`${item.model}-${index}`}><td>{toTitle(item.model)}</td><td>{item.train_score}</td><td>{item.test_score}</td></tr>)}</tbody></table></div> : <p className="empty-state">Only one model was trained.</p>}</article><article className="panel inner-panel training-full-span"><h4>Top feature drivers</h4>{training.top_features?.length ? <div className="table-shell"><table><thead><tr><th>#</th><th>Feature</th><th>Importance</th></tr></thead><tbody>{training.top_features.map((item, index) => <tr key={`${item.name}-${index}`}><td>{index + 1}</td><td>{item.name}</td><td>{item.importance}</td></tr>)}</tbody></table></div> : <p className="empty-state">Feature ranking is not available for this model.</p>}</article><article className="panel inner-panel training-full-span"><h4>Prediction preview</h4>{training.prediction_preview?.length ? <div className="table-shell"><table><thead><tr><th>Actual</th><th>Predicted</th></tr></thead><tbody>{training.prediction_preview.map((item, index) => <tr key={`${item.actual}-${item.predicted}-${index}`}><td>{item.actual}</td><td>{item.predicted}</td></tr>)}</tbody></table></div> : <p className="empty-state">Prediction preview will appear after training.</p>}</article></div> : <p className="empty-state">Train a model to see detailed metrics here.</p>}</article></section>;
  }

  return <main className="app-shell"><aside className="nav-sidebar"><div className="sidebar-top"><div><p className="eyebrow">Signed in</p><h2>{user.full_name}</h2><p>{user.email}</p></div><button type="button" className="logout-btn" onClick={onLogout}>Logout</button></div><nav className="sidebar-nav">{navItems.map((item) => <button type="button" key={item.id} className={activeView === item.id ? "nav-pill active" : "nav-pill"} onClick={() => setActiveView(item.id)}>{item.label}</button>)}</nav></aside><section className="main-content"><header className="hero hero-pro"><div><p className="eyebrow">Data Forge workspace</p><h1>Build a professional data workflow from upload to dashboard export.</h1></div><div className="hero-actions"><button type="button" onClick={handleDashboardExport} disabled={!activeProjectId}>Export PDF</button><button type="button" onClick={handleDatasetDownload} disabled={!activeDatasetId}>Download dataset</button></div></header>{message ? <p className="status-banner">{message}</p> : null}{error ? <p className="error-banner">{error}</p> : null}{activeView === "overview" ? renderOverview() : null}{activeView === "projects" ? renderProjectsView() : null}{activeView === "ingest" ? renderIngest() : null}{activeView === "preview" ? renderPreviewView() : null}{activeView === "clean" ? renderClean() : null}{activeView === "eda" ? renderEda() : null}{activeView === "viz" ? renderViz() : null}{activeView === "ml" ? renderMl() : null}</section><aside className="history-rail"><section className="panel"><div className="rail-header"><h3>Projects</h3><button type="button" className="danger-link" onClick={handleProjectDelete} disabled={!activeProjectId}>Delete current</button></div><button type="button" onClick={handleProjectCreate}>Create new project</button><div className="project-list">{projects.map((project) => <div key={project.id} className={project.id === activeProjectId ? "project-row active" : "project-row"}><button type="button" className="project-main" onClick={() => { setActiveProjectId(project.id); setActiveView("overview"); }}><strong>{project.name}</strong><span>{project.description || "No description"}</span></button><button type="button" className="project-delete" onClick={() => handleProjectDelete(project.id)}>Delete</button></div>)}</div></section><section className="panel"><h3>Datasets</h3><div className="dataset-list">{datasets.length ? datasets.map((dataset) => <button type="button" key={dataset.id} className={dataset.id === activeDatasetId ? "dataset-item active" : "dataset-item"} onClick={() => { setActiveDatasetId(dataset.id); setActiveView("overview"); }}><strong>{dataset.name}</strong><span>{dataset.row_count} rows, {dataset.column_count} columns</span></button>) : <p className="empty-state">No datasets yet.</p>}</div></section><section className="panel"><h3>History</h3><div className="history-list">{history.length ? history.map((item) => <article key={item.id} className="history-card"><strong>{item.title}</strong><span>{toPretty(item.run_type)} on {item.dataset_name}</span><small>{new Date(item.created_at).toLocaleString()}</small></article>) : <p className="empty-state">No history yet.</p>}</div></section></aside></main>;
}





























