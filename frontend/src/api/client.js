const API_URL = "http://localhost:8000/api";

function getToken() {
  return localStorage.getItem("data_forge_token");
}

function saveToken(token) {
  localStorage.setItem("data_forge_token", token);
}

function clearToken() {
  localStorage.removeItem("data_forge_token");
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getToken();

  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      mode: "cors",
    });
  } catch {
    throw new Error("Cannot connect to backend server on http://localhost:8000.");
  }

  if (!response.ok) {
    let message = "Request failed";
    try {
      const err = await response.json();
      message = err.detail || message;
    } catch {}
    if (response.status === 401 || response.status === 403) {
      clearToken();
      throw new Error("Your session expired or is invalid. Please login again.");
    }
    throw new Error(message);
  }

  const type = response.headers.get("content-type") || "";
  if (type.includes("application/json")) {
    return response.json();
  }
  return response.blob();
}

export const api = {
  getToken,
  saveToken,
  clearToken,
  register(payload) { return request("/auth/register", { method: "POST", body: JSON.stringify(payload) }); },
  login(payload) { return request("/auth/login", { method: "POST", body: JSON.stringify(payload) }); },
  forgotPassword(payload) { return request("/auth/forgot-password", { method: "POST", body: JSON.stringify(payload) }); },
  resetPassword(payload) { return request("/auth/reset-password", { method: "POST", body: JSON.stringify(payload) }); },
  me() { return request("/auth/me"); },
  listProjects() { return request("/projects"); },
  createProject(payload) { return request("/projects", { method: "POST", body: JSON.stringify(payload) }); },
  deleteProject(projectId) { return request(`/projects/${projectId}`, { method: "DELETE" }); },
  uploadDataset(projectId, formData) { return request(`/projects/${projectId}/datasets`, { method: "POST", body: formData }); },
  listDatasets(projectId) { return request(`/projects/${projectId}/datasets`); },
  getHistory(projectId) { return request(`/projects/${projectId}/history`); },
  previewDataset(projectId, datasetId) { return request(`/projects/${projectId}/datasets/${datasetId}/preview`); },
  cleanDataset(projectId, datasetId, payload) { return request(`/projects/${projectId}/datasets/${datasetId}/clean`, { method: "POST", body: JSON.stringify(payload) }); },
  getEda(projectId, datasetId) { return request(`/projects/${projectId}/datasets/${datasetId}/eda`); },
  getVisualizations(projectId, datasetId, payload) { return request(`/projects/${projectId}/datasets/${datasetId}/visualize`, { method: "POST", body: JSON.stringify(payload) }); },
  trainModel(projectId, datasetId, payload) { return request(`/projects/${projectId}/datasets/${datasetId}/train`, { method: "POST", body: JSON.stringify(payload) }); },
  getDashboard(projectId) { return request(`/projects/${projectId}/dashboard`); },
  downloadDataset(projectId, datasetId) { return request(`/projects/${projectId}/datasets/${datasetId}/download`); },
  exportDashboard(projectId) { return request(`/projects/${projectId}/dashboard/export`); },
};

