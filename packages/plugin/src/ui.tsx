import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';

const App: React.FC = () => {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsLoading(true);
    setStatus('Starting crawl...');

    parent.postMessage(
      {
        pluginMessage: {
          type: 'start-crawl',
          url: url.trim(),
        },
      },
      '*'
    );
  };

  const handleClose = () => {
    parent.postMessage(
      {
        pluginMessage: {
          type: 'close',
        },
      },
      '*'
    );
  };

  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { type, jobId } = event.data.pluginMessage || {};

      if (type === 'crawl-started') {
        setStatus(`Crawl started! Job ID: ${jobId}`);
        setIsLoading(false);
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
        <div style={{ marginBottom: '12px' }}>
          <label
            htmlFor="url"
            style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}
          >
            Website URL:
          </label>
          <input
            id="url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            required
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '12px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !url.trim()}
          style={{
            width: '100%',
            padding: '8px 16px',
            backgroundColor: isLoading ? '#ccc' : '#0066cc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '12px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
          }}
        >
          {isLoading ? 'Starting Crawl...' : 'Start Crawl'}
        </button>
      </form>

      {status && (
        <div
          style={{
            padding: '8px',
            backgroundColor: '#f0f0f0',
            borderRadius: '4px',
            fontSize: '11px',
            marginBottom: '12px',
          }}
        >
          {status}
        </div>
      )}

      <button
        onClick={handleClose}
        style={{
          width: '100%',
          padding: '6px 16px',
          backgroundColor: 'transparent',
          color: '#666',
          border: '1px solid #ccc',
          borderRadius: '4px',
          fontSize: '12px',
          cursor: 'pointer',
        }}
      >
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
