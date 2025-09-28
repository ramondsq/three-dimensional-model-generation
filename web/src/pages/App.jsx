import React, { useEffect, useState } from 'react'
import axios from 'axios'

function useRecent() {
  const [items, setItems] = useState([])
  useEffect(() => {
    axios.get('/api/recent').then(r => setItems(r.data.items || [])).catch(() => {})
  }, [])
  return items
}

function FileInput({ onFile }) {
  return (
    <input type="file" accept="image/*" onChange={(e) => {
      const f = e.target.files?.[0]
      if (f) onFile(f)
    }} />
  )
}

export default function App() {
  const [prompt, setPrompt] = useState('A cute low-poly horse')
  const [jobId, setJobId] = useState('')
  const [job, setJob] = useState(null)
  const [busy, setBusy] = useState(false)
  const [cacheSuggestion, setCacheSuggestion] = useState(null)
  const recent = useRecent()

  useEffect(() => {
    const p = prompt.trim()
    if (!p) return setCacheSuggestion(null)
    const ctl = new AbortController()
    axios.get('/api/cache/lookup', { params: { prompt: p }, signal: ctl.signal })
      .then(r => setCacheSuggestion(r.data.match))
      .catch(() => {})
    return () => ctl.abort()
  }, [prompt])

  useEffect(() => {
    if (!jobId) return
    const t = setInterval(async () => {
      const { data } = await axios.get(`/api/jobs/${jobId}`)
      setJob(data)
      if (data.status === 'done' || data.status === 'error') clearInterval(t)
    }, 1500)
    return () => clearInterval(t)
  }, [jobId])

  const submitText = async () => {
    setBusy(true)
    try {
      const { data } = await axios.post('/api/generate/text', { prompt })
      setJobId(data.jobId)
      setJob(null)
    } finally {
      setBusy(false)
    }
  }

  const submitImage = async (file) => {
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('image', file)
      fd.append('prompt', prompt)
      const { data } = await axios.post('/api/generate/image', fd)
      setJobId(data.jobId)
      setJob(null)
    } finally {
      setBusy(false)
    }
  }

  const sendFeedback = async (rating) => {
    if (!jobId) return
    const notes = window.prompt('Optional notes?') || ''
    await axios.post('/api/feedback', { jobId, rating, notes })
    const { data } = await axios.get(`/api/jobs/${jobId}`)
    setJob(data)
  }

  const canPreview = job?.status === 'done' && job?.fileUrl
  const badgeClass = job?.status ? `badge badge--${job.status}` : 'badge'

  return (
    <div className="container">
      <header className="app-header">
        <div>
          <h1 className="title">3D Model Generator</h1>
          <p className="subtitle">Turn text or an image into a 3D asset. Provider: Meshy</p>
        </div>
      </header>

      <div className="grid two">
        <div className="card">
          <div className="card__body">
            <h3 className="section-title">Prompt</h3>
            <textarea className="textarea" value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Describe the model you want..." />
            <div className="actions">
              <button className="btn btn-primary" disabled={busy} onClick={submitText}>Generate from Text</button>
              <label className="file-input">
                <span className="keyline">Image to 3D:</span>
                <FileInput onFile={submitImage} />
              </label>
            </div>
            {cacheSuggestion && (
              <div className="spacer" />
            )}
            {cacheSuggestion && (
              <div className="row">
                <span className="muted">Similar cached result found</span>
                <a className="link" href={`/view/${cacheSuggestion.jobId}`} target="_blank">Open</a>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card__body stack">
            <h3 className="section-title">Status</h3>
            <div className="row">
              <span className="keyline">Job ID:</span>
              <code>{jobId || '-'}</code>
              <span className={badgeClass}>{job?.status || '-'}</span>
            </div>
            {typeof job?.progress === 'number' && job?.status !== 'done' && (
              <div>
                <div className="progress"><div className="progress__bar" style={{ width: `${Math.max(0, Math.min(100, job.progress))}%` }} /></div>
                <div className="progress__meta">{Math.round(job.progress)}%</div>
              </div>
            )}
            {typeof job?.queue === 'number' && job?.status === 'pending' && (
              <div className="progress__meta">Queued ahead: {job.queue}</div>
            )}
            {job?.thumbnailUrl && job?.status !== 'done' && (
              <img className="thumb" src={job.thumbnailUrl} alt="preview" />
            )}
            {job?.error && <div style={{ color: 'crimson', fontWeight: 600 }}>Error: {job.error}</div>}

            {canPreview && (
              <div>
                <model-viewer src={job.fileUrl} camera-controls auto-rotate class="viewer"></model-viewer>
                <div className="card__footer">
                  <a className="link" href={job.fileUrl} download>Download</a>
                  <div className="row">
                    <button className="btn btn-ghost" onClick={() => sendFeedback(1)}>👍 Good</button>
                    <button className="btn btn-ghost" onClick={() => sendFeedback(-1)}>👎 Bad</button>
                  </div>
                </div>
                {job.metrics && (
                  <div className="muted" style={{ marginTop: 6, fontSize: 14 }}>
                    <div>Score: {job.metrics.simpleScore}</div>
                    <div>Validator: {job.metrics.validator.errors} errors, {job.metrics.validator.warnings} warnings</div>
                    <div>Content: {job.metrics.content.meshes} meshes, {job.metrics.content.materials} materials, {job.metrics.content.images} images</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <div className="card">
          <div className="card__body">
            <h3 className="section-title">Recent</h3>
            <div className="recent-grid">
              {recent.map(r => (
                <div key={r.id} className="card" style={{ boxShadow: 'none' }}>
                  <div className="card__body">
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <span className="time">{new Date(r.createdAt).toLocaleString()}</span>
                      <span className={`badge badge--${r.status}`}>{r.status}</span>
                    </div>
                    <div className="ellipsis" style={{ fontSize: 13, marginTop: 6 }}>{r.prompt}</div>
                    {r.fileUrl ? (
                      <model-viewer src={r.fileUrl} class="viewer viewer--sm"></model-viewer>
                    ) : (
                      <div style={{ display: 'grid', gap: 8 }}>
                        <div className="progress"><div className="progress__bar" style={{ width: `${Math.max(0, Math.min(100, r.progress || 0))}%` }} /></div>
                      </div>
                    )}
                    <div className="card__footer">
                      {r.fileUrl ? (
                        <>
                          <a className="link" href={`/view/${r.id}`} target="_blank">Open</a>
                          <a className="link" href={r.fileUrl} download>Download</a>
                        </>
                      ) : (
                        <span className="muted">Processing…</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
