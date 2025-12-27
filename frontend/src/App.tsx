import { useState } from "react";

type ImportResult = {
  id: number;
  source: string;
  title?: string | null;
  created_at?: string | null;
};

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState<number | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setStatus(null);
    setCount(null);

    if (!file) {
      setError("Pick a ChatGPT conversations.json file to import.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setStatus("Uploading...");
      const response = await fetch("http://localhost:8000/import/chatgpt", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.detail ?? "Import failed");
      }

      const data: ImportResult[] = await response.json();
      setCount(data.length);
      setStatus("Import complete!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  return (
    <div className="app">
      <div className="hero">
        <h1>ChatArchive</h1>
        <p>
          Bring your ChatGPT archives home. Upload an export and start building
          a searchable vault of every conversation.
        </p>
        <div className="grid">
          <div className="card">
            <strong>Local-first</strong>
            <p>Everything stays on your machine with SQLite storage.</p>
          </div>
          <div className="card">
            <strong>Fast import</strong>
            <p>Drop your JSON export to seed the archive instantly.</p>
          </div>
          <div className="card">
            <strong>Search-ready</strong>
            <p>Structure is ready for tags, filters, and analytics.</p>
          </div>
        </div>
        <form className="uploader" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="file">ChatGPT export (conversations.json)</label>
          </div>
          <input
            id="file"
            type="file"
            accept="application/json"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <button className="button" type="submit">
            Import
          </button>
        </form>
        {status && <div className="status">{status}</div>}
        {count !== null && (
          <div className="status">Imported {count} conversations.</div>
        )}
        {error && <div className="status error">{error}</div>}
      </div>
    </div>
  );
}
