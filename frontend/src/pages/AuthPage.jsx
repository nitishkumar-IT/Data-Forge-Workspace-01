import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";

export function AuthPage({ onAuthenticated }) {
  const initialSearch = useMemo(() => new URLSearchParams(window.location.search), []);
  const emailResetToken = initialSearch.get("token") || "";
  const initialMode = initialSearch.get("mode") === "forgot" || emailResetToken ? "forgot" : "login";

  const [mode, setMode] = useState(initialMode);
  const [registerForm, setRegisterForm] = useState({ full_name: "", email: "", password: "" });
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [forgotEmail, setForgotEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (emailResetToken) {
      setMessage("Reset link verified. Enter your new password below.");
    }
  }, [emailResetToken]);

  async function handleRegister(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const result = await api.register(registerForm);
      api.saveToken(result.access_token);
      onAuthenticated();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const result = await api.login(loginForm);
      api.saveToken(result.access_token);
      onAuthenticated();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleForgotPassword(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const result = await api.forgotPassword({ email: forgotEmail });
      setMessage(result.message || "If the email exists, a reset link has been sent.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handlePasswordReset(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const result = await api.resetPassword({ token: emailResetToken, new_password: newPassword });
      setMessage(result.message);
      const url = new URL(window.location.href);
      url.searchParams.delete("token");
      url.searchParams.delete("mode");
      window.history.replaceState({}, "", url.toString());
      setMode("login");
      setNewPassword("");
    } catch (err) {
      setError(err.message);
    }
  }

  const forgotHeading = emailResetToken ? "Set a new password" : "Recover your password";
  const forgotCopy = emailResetToken
    ? "This secure reset link came from your email. Create a new password to finish recovery."
    : "Enter your registered email and we will send you a reset link there.";

  return (
    <main className="auth-page">
      <section className="auth-panel auth-panel-pro">
        <div className="auth-copy auth-copy-pro">
          <p className="eyebrow">Data Forge</p>
          <h1>Professional data workflows, saved history, and a dashboard you can come back to anytime.</h1>
          <p>Build company-style dashboards with upload, cleaning, EDA, visualization, ML training, exports, and persistent project history.</p>
          <div className="auth-feature-list">
            <div className="auth-feature-card"><strong>Persistent projects</strong><span>Come back later and keep datasets, runs, and exports.</span></div>
            <div className="auth-feature-card"><strong>Python backend</strong><span>Use FastAPI and Python tooling for data science workflows.</span></div>
            <div className="auth-feature-card"><strong>Dashboard workflow</strong><span>Move from raw data to business-ready charts and model metrics.</span></div>
          </div>
        </div>
        <div className="auth-form-shell auth-form-shell-pro">
          <div className="auth-tabs auth-tabs-3">
            <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Login</button>
            <button type="button" className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Register</button>
            <button type="button" className={mode === "forgot" ? "active" : ""} onClick={() => setMode("forgot")}>Forgot Password</button>
          </div>
          <div className="auth-form-header">
            <h2>{mode === "login" ? "Welcome back" : mode === "register" ? "Create your account" : forgotHeading}</h2>
            <p>{mode === "login" ? "Login to continue with your saved projects and dashboard history." : mode === "register" ? "Create an account to save data science workflows permanently." : forgotCopy}</p>
          </div>
          {mode === "login" ? <form className="auth-form" onSubmit={handleLogin}><input placeholder="Email address" value={loginForm.email} onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })} /><input placeholder="Password" type="password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} /><button type="submit">Login to workspace</button></form> : null}
          {mode === "register" ? <form className="auth-form" onSubmit={handleRegister}><input placeholder="Full name" value={registerForm.full_name} onChange={(e) => setRegisterForm({ ...registerForm, full_name: e.target.value })} /><input placeholder="Email address" value={registerForm.email} onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })} /><input placeholder="Password" type="password" value={registerForm.password} onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })} /><button type="submit">Create account</button></form> : null}
          {mode === "forgot" ? (!emailResetToken ? <form className="auth-form" onSubmit={handleForgotPassword}><input placeholder="Registered email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} /><button type="submit">Send reset link</button></form> : <form className="auth-form" onSubmit={handlePasswordReset}><input value="Reset link received from email" readOnly /><input placeholder="New password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /><button type="submit">Save new password</button></form>) : null}
          {message ? <p className="form-success">{message}</p> : null}
          {error ? <p className="form-error">{error}</p> : null}
        </div>
      </section>
    </main>
  );
}
