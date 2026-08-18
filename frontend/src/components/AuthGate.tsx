import { FormEvent, useState } from "react";

import { API_URL, apiFetch, clearToken, setToken } from "../api";

type AuthGateProps = {
  onSuccess: () => void;
};

export default function AuthGate({ onSuccess }: AuthGateProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!value.trim()) return;

    setChecking(true);
    setError(null);
    setToken(value.trim());

    try {
      const response = await apiFetch(`${API_URL}/stats`);
      if (response.ok) {
        onSuccess();
      } else {
        clearToken();
        setError("That token was rejected.");
      }
    } catch {
      clearToken();
      setError("Could not reach the backend to verify the token.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="auth-gate">
      <form className="auth-gate-card" onSubmit={handleSubmit}>
        <h2>ChatArchive is locked</h2>
        <p className="auth-gate-lede">Enter the API token to continue.</p>
        <div className="form-group">
          <label htmlFor="auth-gate-token">API Token</label>
          <input
            id="auth-gate-token"
            type="password"
            autoFocus
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Paste your APP_API_TOKEN"
          />
        </div>
        {error && <div className="error-item">{error}</div>}
        <button type="submit" className="import-btn" disabled={checking || !value.trim()}>
          {checking ? "Checking..." : "Unlock"}
        </button>
      </form>
    </div>
  );
}
