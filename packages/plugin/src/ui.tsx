import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';

const App: React.FC = () => {
  const [url, setUrl] = useState('https://crawlee.dev');
  const [maxRequests, setMaxRequests] = useState('10');
  const [screenshotWidth, setScreenshotWidth] = useState('1440');
  const [deviceScaleFactor, setDeviceScaleFactor] = useState('1');
  const [delay, setDelay] = useState('0');
  const [requestDelay, setRequestDelay] = useState('1000');
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

    // Parse screenshot width: default to 1440 if invalid or empty
    const screenshotWidthValue = screenshotWidth.trim() === '' ? 1440 : parseInt(screenshotWidth);
    const screenshotWidthParam = isNaN(screenshotWidthValue) || screenshotWidthValue <= 0 ? 1440 : screenshotWidthValue;

    // Parse device scale factor: default to 1 if invalid
    const deviceScaleFactorValue = deviceScaleFactor.trim() === '' ? 1 : parseInt(deviceScaleFactor);
    const deviceScaleFactorParam = isNaN(deviceScaleFactorValue) || deviceScaleFactorValue < 1 || deviceScaleFactorValue > 2 ? 1 : deviceScaleFactorValue;

    // Parse delay: default to 0 if invalid or empty
    const delayValue = delay.trim() === '' ? 0 : parseInt(delay);
    const delayParam = isNaN(delayValue) || delayValue < 0 ? 0 : delayValue;

    // Parse request delay: default to 1000ms if invalid or empty
    const requestDelayValue = requestDelay.trim() === '' ? 1000 : parseInt(requestDelay);
    const requestDelayParam = isNaN(requestDelayValue) || requestDelayValue < 0 ? 1000 : requestDelayValue;

    setIsLoading(true);
    setStatus('Starting crawl...');

    parent.postMessage({ pluginMessage: { type: 'start-crawl', url: url.trim(), maxRequestsPerCrawl, screenshotWidth: screenshotWidthParam, deviceScaleFactor: deviceScaleFactorParam, delay: delayParam, requestDelay: requestDelayParam } }, '*');
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
        let statusText = `Job ${msg.jobId}: ${msg.status}`;
        
        if (msg.detailedProgress) {
          const { stage, currentPage, totalPages, currentUrl, progress } = msg.detailedProgress;
          statusText = `Job ${msg.jobId}: ${msg.status} - ${stage}`;
          
          if (currentUrl) {
            statusText += ` - ${currentUrl}`;
          }
          
          if (currentPage && totalPages) {
            statusText += ` (${currentPage}/${totalPages})`;
          }
          
          if (typeof progress === 'number') {
            statusText += ` ${progress}%`;
          }
        } else if (msg.progress && typeof msg.progress === 'number') {
          statusText += ` (${msg.progress}%)`;
        }
        
        setStatus(statusText);

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
        <input
          type="number"
          value={screenshotWidth}
          onChange={(e) => setScreenshotWidth(e.target.value)}
          placeholder="Screenshot width (1440)"
          disabled={isLoading || !!jobId}
          style={{ width: '100%', padding: '8px', boxSizing: 'border-box', marginBottom: '8px' }}
          min="320"
          max="3840"
        />
        <div style={{ fontSize: '10px', color: '#666', marginBottom: '8px' }}>
          Screenshot width in pixels (320-3840px)
        </div>
        <select
          value={deviceScaleFactor}
          onChange={(e) => setDeviceScaleFactor(e.target.value)}
          disabled={isLoading || !!jobId}
          style={{ width: '100%', padding: '8px', boxSizing: 'border-box', marginBottom: '8px' }}
        >
          <option value="1">1x Resolution</option>
          <option value="2">2x Resolution (Higher Quality)</option>
        </select>
        <div style={{ fontSize: '10px', color: '#666', marginBottom: '8px' }}>
          Higher resolution screenshots take longer to process
        </div>
        <input
          type="number"
          value={delay}
          onChange={(e) => setDelay(e.target.value)}
          placeholder="Delay in seconds (0)"
          disabled={isLoading || !!jobId}
          style={{ width: '100%', padding: '8px', boxSizing: 'border-box', marginBottom: '8px' }}
          min="0"
          max="60"
        />
        <div style={{ fontSize: '10px', color: '#666', marginBottom: '8px' }}>
          Additional delay after page load (0-60 seconds)
        </div>
        <input
          type="number"
          value={requestDelay}
          onChange={(e) => setRequestDelay(e.target.value)}
          placeholder="Delay between requests in ms (1000)"
          disabled={isLoading || !!jobId}
          style={{ width: '100%', padding: '8px', boxSizing: 'border-box', marginBottom: '8px' }}
          min="0"
          max="10000"
          step="100"
        />
        <div style={{ fontSize: '10px', color: '#666', marginBottom: '8px' }}>
          Delay between requests to avoid rate limiting (0-10000ms)
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
