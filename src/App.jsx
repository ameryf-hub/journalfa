import { useEffect, useMemo, useState } from 'react';

const moodOptions = ['Calm', 'Focused', 'Heavy', 'Grateful', 'Restless', 'Hopeful'];

const emptyForm = {
  title: '',
  content: '',
  mood: 'Calm',
  tags: ''
};

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginSaving, setLoginSaving] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    loadSession();
  }, []);

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return entries;
    }

    return entries.filter((entry) => {
      const haystack = [entry.title, entry.content, entry.mood, ...(entry.tags || [])]
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [entries, query]);

  const stats = useMemo(() => {
    const mostRecent = entries[0];
    return {
      count: entries.length,
      recentLabel: mostRecent ? formatDate(mostRecent.created_at) : 'No entries yet'
    };
  }, [entries]);

  async function loadEntries() {
    try {
      setLoading(true);
      setError('');
      const response = await fetch('/api/entries', { credentials: 'include' });
      if (response.status === 401) {
        setAuthenticated(false);
        setEntries([]);
        return;
      }
      if (!response.ok) throw new Error('Failed to load entries');
      const data = await response.json();
      setEntries(data.entries);
    } catch (fetchError) {
      setError(fetchError.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadSession() {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'include' });

      if (response.ok) {
        setAuthenticated(true);
        await loadEntries();
      } else {
        setAuthenticated(false);
      }
    } catch (sessionError) {
      setLoginError(sessionError.message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();

    try {
      setLoginSaving(true);
      setLoginError('');

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(loginForm)
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Unable to sign in');
      }

      setAuthenticated(true);
      setLoginForm({ username: '', password: '' });
      await loadEntries();
    } catch (authError) {
      setLoginError(authError.message);
    } finally {
      setLoginSaving(false);
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setAuthenticated(false);
    setEntries([]);
    setForm(emptyForm);
    setEditingId(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setSaving(true);
      setError('');

      const response = await fetch(editingId ? `/api/entries/${editingId}` : '/api/entries', {
        method: editingId ? 'PUT' : 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(form)
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Unable to save entry');
      }

      setForm(emptyForm);
      setEditingId(null);
      await loadEntries();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSaving(false);
    }
  }

  function startEditing(entry) {
    setEditingId(entry.id);
    setForm({
      title: entry.title || '',
      content: entry.content || '',
      mood: entry.mood || 'Calm',
      tags: (entry.tags || []).join(', ')
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleDelete(entryId) {
    const confirmed = window.confirm('Delete this journal entry?');
    if (!confirmed) return;

    try {
      setError('');
      const response = await fetch(`/api/entries/${entryId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!response.ok && response.status !== 204) {
        throw new Error('Unable to delete entry');
      }

      if (editingId === entryId) {
        setEditingId(null);
        setForm(emptyForm);
      }

      await loadEntries();
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  if (authLoading) {
    return (
      <main className="app-shell">
        <section className="hero-panel">
          <div className="hero-copy">
            <span className="eyebrow">Private journal</span>
            <h1>Loading your journal.</h1>
            <p>Checking your session before opening the workspace.</p>
          </div>
        </section>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="app-shell auth-shell">
        <section className="hero-panel auth-hero">
          <div className="hero-copy">
            <span className="eyebrow">Private journal</span>
            <h1>Sign in to your private journal.</h1>
            <p>Only you can unlock the journal data stored in Railway.</p>
          </div>

          <form className="composer auth-card" onSubmit={handleLogin}>
            <label>
              Username
              <input
                value={loginForm.username}
                onChange={(event) => setLoginForm((current) => ({ ...current, username: event.target.value }))}
                placeholder="Your journal username"
                autoComplete="username"
              />
            </label>

            <label>
              Password
              <input
                type="password"
                value={loginForm.password}
                onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
                placeholder="Your journal password"
                autoComplete="current-password"
              />
            </label>

            {loginError ? <p className="error-banner">{loginError}</p> : null}

            <div className="composer-actions">
              <button type="submit" className="primary-button" disabled={loginSaving}>
                {loginSaving ? 'Signing in...' : 'Sign in'}
              </button>
            </div>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow">Private journal</span>
          <h1>Keep the private parts of your day in one calm place.</h1>
          <p>
            Write fast, revisit later, and store everything in your Railway-backed database.
          </p>
        </div>

        <div className="stats-grid">
          <article className="stat-card">
            <span>Entries saved</span>
            <strong>{stats.count}</strong>
          </article>
          <article className="stat-card">
            <span>Latest entry</span>
            <strong>{stats.recentLabel}</strong>
          </article>
        </div>

        <div className="hero-actions">
          <button type="button" className="ghost-button" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </section>

      <section className="workspace">
        <form className="composer" onSubmit={handleSubmit}>
          <div className="composer-head">
            <div>
              <h2>{editingId ? 'Edit entry' : 'New entry'}</h2>
              <p>Capture a moment, note the mood, and tag it for later.</p>
            </div>
            {editingId ? (
              <button type="button" className="ghost-button" onClick={resetForm}>
                Cancel edit
              </button>
            ) : null}
          </div>

          <label>
            Title
            <input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="A quiet morning"
            />
          </label>

          <div className="field-row">
            <label>
              Mood
              <select
                value={form.mood}
                onChange={(event) => setForm((current) => ({ ...current, mood: event.target.value }))}
              >
                {moodOptions.map((mood) => (
                  <option key={mood} value={mood}>
                    {mood}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Tags
              <input
                value={form.tags}
                onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))}
                placeholder="work, family, idea"
              />
            </label>
          </div>

          <label>
            Journal entry
            <textarea
              value={form.content}
              onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
              placeholder="What happened today? What do you want to remember?"
              rows={11}
            />
          </label>

          {error ? <p className="error-banner">{error}</p> : null}

          <div className="composer-actions">
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? 'Saving...' : editingId ? 'Update entry' : 'Save entry'}
            </button>
            <button type="button" className="secondary-button" onClick={resetForm}>
              Clear
            </button>
          </div>
        </form>

        <aside className="entry-panel">
          <div className="entry-panel-head">
            <div>
              <h2>Recent entries</h2>
              <p>Your private archive, searchable and editable.</p>
            </div>
            <input
              className="search-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search entries"
            />
          </div>

          {loading ? <div className="empty-state">Loading your journal...</div> : null}

          {!loading && filteredEntries.length === 0 ? (
            <div className="empty-state">
              <h3>No entries found</h3>
              <p>Write your first note, or clear the search to see everything.</p>
            </div>
          ) : null}

          <div className="entry-list">
            {filteredEntries.map((entry) => (
              <article className="entry-card" key={entry.id}>
                <div className="entry-card-top">
                  <div>
                    <span className="entry-date">{formatDate(entry.created_at)}</span>
                    <h3>{entry.title || 'Untitled entry'}</h3>
                  </div>
                  <span className="mood-pill">{entry.mood || 'Calm'}</span>
                </div>

                <p>{entry.content}</p>

                <div className="tag-row">
                  {(entry.tags || []).map((tag) => (
                    <span className="tag-pill" key={tag}>
                      #{tag}
                    </span>
                  ))}
                </div>

                <div className="entry-actions">
                  <button type="button" className="text-button" onClick={() => startEditing(entry)}>
                    Edit
                  </button>
                  <button type="button" className="text-button danger" onClick={() => handleDelete(entry.id)}>
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value));
}