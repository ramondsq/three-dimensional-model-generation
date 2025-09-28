import React, { useEffect, useMemo, useState } from 'react'
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

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui, sans-serif', maxWidth: 1024, margin: '0 auto' }}>
      <h1>3D Model Generator</h1>
      <p>Generate a single 3D asset from text or image. Provider: Meshy.</p>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
        <div>
          <h3>Prompt</h3>
          <textarea rows={4} style={{ width: '100%' }} value={prompt} onChange={e => setPrompt(e.target.value)} />
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <button disabled={busy} onClick={submitText}>Generate from Text</button>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span>Image to 3D:</span>
              <FileInput onFile={submitImage} />
            </label>
          </div>
          {cacheSuggestion && (
            <div style={{ marginTop: 8, padding: 8, background: '#f6f6f6', borderRadius: 6 }}>
              <strong>Similar cached result:</strong>
              <div>
                <a href={`/view/${cacheSuggestion.jobId}`} target="_blank">Open</a>
              </div>
            </div>
          )}
        </div>

        <div>
          <h3>Status</h3>
          <div>
            <div>Job ID: {jobId || '-'}</div>
            <div>Status: {job?.status || '-'}</div>
            {typeof job?.progress === 'number' && job?.status !== 'done' && (
              <div style={{ marginTop: 8 }}>
                <div style={{ height: 10, background: '#eee', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.max(0, Math.min(100, job.progress))}%`, height: '100%', background: '#4caf50', transition: 'width 0.5s' }} />
                </div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{Math.round(job.progress)}%</div>
              </div>
            )}
            {typeof job?.queue === 'number' && job?.status === 'pending' && (
              <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>Queued ahead: {job.queue}</div>
            )}
            {job?.thumbnailUrl && job?.status !== 'done' && (
              <div style={{ marginTop: 8 }}>
                <img src={job.thumbnailUrl} alt="preview" style={{ maxWidth: '100%', borderRadius: 6 }} />
              </div>
            )}
            {job?.error && <div style={{ color: 'crimson' }}>Error: {job.error}</div>}
          </div>

          {canPreview && (
            <div style={{ marginTop: 12 }}>
              <model-viewer src={job.fileUrl} camera-controls auto-rotate style={{ width: '100%', height: 360, background: '#222' }}></model-viewer>
              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                <a href={job.fileUrl} download>Download</a>
                <button onClick={() => sendFeedback(1)}>👍 Good</button>
                <button onClick={() => sendFeedback(-1)}>👎 Bad</button>
              </div>
              {job.metrics && (
                <div style={{ marginTop: 8, fontSize: 14 }}>
                  <div>Score: {job.metrics.simpleScore}</div>
                  <div>Validator: {job.metrics.validator.errors} errors, {job.metrics.validator.warnings} warnings</div>
                  <div>Content: {job.metrics.content.meshes} meshes, {job.metrics.content.materials} materials, {job.metrics.content.images} images</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <h3>Recent</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {recent.map(r => (
            <div key={r.id} style={{ border: '1px solid #eee', borderRadius: 6, padding: 8 }}>
              <div style={{ fontSize: 12, color: '#666' }}>{new Date(r.createdAt).toLocaleString()}</div>
              <div style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.prompt}</div>
              {r.fileUrl ? (
                <model-viewer src={r.fileUrl} style={{ width: '100%', height: 180, background: '#111' }}></model-viewer>
              ) : (
                <div style={{ height: 180, display: 'grid', placeItems: 'center', background: '#fafafa' }}>
                  <div>{r.status}</div>
                  {typeof r.progress === 'number' && (
                    <div style={{ width: '100%', marginTop: 6 }}>
                      <div style={{ height: 6, background: '#eee', borderRadius: 6, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.max(0, Math.min(100, r.progress))}%`, height: '100%', background: '#4caf50' }} />
                      </div>
                    </div>
                  )}
                </div>
              )}
              {r.fileUrl && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                  <a href={`/view/${r.id}`} target="_blank">Open</a>
                  <a href={r.fileUrl} download>Download</a>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
