import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';

const App: React.FC = () => {
  const [url, setUrl] = useState('https://crawlee.dev');
  const [maxRequests, setMaxRequests] = useState('10');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    // Parse max requests: empty, 0, or >= 999 means infinity (no limit)
    const maxRequestsValue = maxRequests.trim() === '' ? 0 : parseInt(maxRequests);
    const maxRequestsPerCrawl = (isNaN(maxRequestsValue) || maxRequestsValue === 0 || maxRequestsValue >= 999) ? undefined : maxRequestsValue;

    setIsLoading(true);
    setStatus('Starting crawl...');

    parent.postMessage({ pluginMessage: { type: 'start-crawl', url: url.trim(), maxRequestsPerCrawl } }, '*');
  };

  const handleClose = () => {
    parent.postMessage({ pluginMessage: { type: 'close' } }, '*');
  };

  // This effect starts/stops the polling
  useEffect(() => {
    if (jobId && !intervalRef.current) {
      intervalRef.current = window.setInterval(() => {
        parent.postMessage({ pluginMessage: { type: 'get-status', jobId } }, '*');
      }, 3000);
    }

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [jobId]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (!msg) return;

      if (msg.type === 'crawl-started') {
        setStatus(`Crawl started! Job ID: ${msg.jobId}`);
        setJobId(msg.jobId);
        setIsLoading(false);
      }

      if (msg.type === 'status-update') {
        setStatus(`Job ${msg.jobId}: ${msg.status} (${msg.progress}%)`);

        if (msg.status === 'completed') {
          if (intervalRef.current) {
            window.clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setStatus(`Crawl complete! Manifest at: ${msg.manifestUrl}`);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <div style={{ padding: '16px', fontFamily: 'Inter, sans-serif' }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 600 }}>
        Figma Site Mapper
      </h3>

      <form onSubmit={handleSubmit} style={{ marginBottom: '16px' }}>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          required
          disabled={isLoading || !!jobId}
          style={{ width: '100%', padding: '8px', boxSizing: 'border-box', marginBottom: '8px' }}
        />
        <input
          type="number"
          value={maxRequests}
          onChange={(e) => setMaxRequests(e.target.value)}
          placeholder="Max requests (10)"
          disabled={isLoading || !!jobId}
          style={{ width: '100%', padding: '8px', boxSizing: 'border-box', marginBottom: '8px' }}
          min="0"
        />
        <div style={{ fontSize: '10px', color: '#666', marginBottom: '8px' }}>
          Leave empty, 0, or ≥999 for unlimited requests
        </div>
        <button
          type="submit"
          disabled={isLoading || !!jobId || !url.trim()}
          style={{ width: '100%', padding: '8px 16px' }}
        >
          {isLoading ? 'Starting...' : (jobId ? 'Crawl in Progress' : 'Start Crawl')}
        </button>
      </form>

      {status && (
        <div style={{ padding: '8px', backgroundColor: '#f0f0f0', borderRadius: '4px', fontSize: '11px', marginBottom: '12px', wordBreak: 'break-all' }}>
          {status}
        </div>
      )}

      <button onClick={handleClose} style={{ width: '100%', padding: '6px 16px', backgroundColor: 'transparent', border: '1px solid #ccc' }}>
        Close
      </button>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
