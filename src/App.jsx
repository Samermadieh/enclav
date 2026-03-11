import React, { useEffect, useState } from 'react';

const DOCKER_DOWNLOAD_URL = 'https://www.docker.com/products/docker-desktop';
const REQUIRED_IMAGE = 'samermadieh/enclav-openclaw';

const statusLabels = {
  idle: 'Ready',
  checking: 'Checking Docker…',
  installed: 'Docker is installed',
  not_installed: 'Docker is not installed',
  error: 'Could not verify Docker'
};

function StatusPill({ status, isChecking, labels }) {
  const cls =
    status === 'ok'
      ? 'status-pill--ok'
      : status === 'warn'
      ? 'status-pill--warn'
      : status === 'error'
      ? 'status-pill--error'
      : 'status-pill--muted';

  return (
    <div className={['status-pill', cls].join(' ')}>
      {isChecking && <span className="status-dot status-dot--pulse" />}
      {!isChecking && <span className="status-dot" />}
      <span>{labels}</span>
    </div>
  );
}

function DockerStep({ onDockerReady }) {
  const [status, setStatus] = useState('checking');
  const [versionInfo, setVersionInfo] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const runCheck = async () => {
    setStatus('checking');
    setErrorMessage(null);

    try {
      const api = window.enclav;

      if (!api || typeof api.checkDocker !== 'function') {
        setStatus('error');
        setErrorMessage(
          'The Enclav desktop runtime is not exposing the Docker check API. Make sure you are running the Electron app, not just the built HTML.'
        );
        return;
      }

      const result = await api.checkDocker();

      if (result?.installed) {
        setStatus('installed');
        setVersionInfo(result.version || 'Unknown version');
        onDockerReady?.(true);
      } else {
        setStatus('not_installed');
        setVersionInfo(null);
        onDockerReady?.(false);
        if (result?.message) {
          setErrorMessage(result.message);
        }
      }
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Unexpected error');
      onDockerReady?.(false);
    }
  };

  useEffect(() => {
    runCheck();
  }, []);

  const handleInstallClick = () => {
    window.open(DOCKER_DOWNLOAD_URL, '_blank', 'noopener,noreferrer');
  };

  const isInstalled = status === 'installed';
  const isChecking = status === 'checking';

  return (
    <section className="step-card">
      <header className="step-header">
        <div className="step-meta">
          <span className="step-label">Step 1</span>
          <h1 className="step-title">Check Docker</h1>
        </div>
        <StatusPill
          status={isInstalled ? 'ok' : status === 'not_installed' ? 'warn' : status === 'error' ? 'error' : 'muted'}
          isChecking={isChecking}
          labels={statusLabels[status]}
        />
      </header>

      <p className="step-description">
        Enclav uses Docker to run AI agents in isolated containers. We will quickly verify that Docker is available on
        your machine before moving on.
      </p>

      {isInstalled && (
        <div className="info-banner info-banner--success">
          <span>Docker detected on this machine.</span>
          {versionInfo && <span className="info-banner-sub">Detected: {versionInfo}</span>}
        </div>
      )}

      {status === 'not_installed' && (
        <div className="info-banner info-banner--warning">
          <span>Docker does not appear to be installed.</span>
          <span className="info-banner-sub">
            You will need Docker Desktop (or a compatible Docker runtime) to continue with Enclav.
          </span>
        </div>
      )}

      {status === 'error' && (
        <div className="info-banner info-banner--error">
          <span>We could not automatically verify Docker.</span>
          {errorMessage && <span className="info-banner-sub">{errorMessage}</span>}
        </div>
      )}

      <div className="step-actions">
        <button
          className="button button-primary"
          type="button"
          onClick={handleInstallClick}
          disabled={isChecking || isInstalled}
        >
          {isInstalled ? 'Docker Installed' : 'Install Docker'}
        </button>

        <button
          className="button button-ghost"
          type="button"
          onClick={runCheck}
          disabled={isChecking}
        >
          {isChecking ? 'Checking…' : 'Re-check'}
        </button>
      </div>

      <footer className="step-footer">
        <span className="step-progress">1 of many simple steps</span>
        <span className="step-hint">
          Once Docker is installed and detected, you will be able to continue to containerizing your first AI agent.
        </span>
      </footer>
    </section>
  );
}

function NodeImageStep({ enabled, onImageReady }) {
  const [status, setStatus] = useState(enabled ? 'checking' : 'blocked');
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);

  const api = window.enclav;
  const canUseApi = api && typeof api.checkDockerImage === 'function' && typeof api.pullDockerImage === 'function';

  const checkImage = async () => {
    if (!enabled) return;
    setStatus('checking');
    setDetail(null);

    if (!canUseApi) {
      setStatus('error');
      setDetail(
        'The Enclav desktop runtime is not exposing the Docker image API. Make sure you are running inside Electron.'
      );
      return;
    }

    const res = await api.checkDockerImage(REQUIRED_IMAGE);
    if (res?.exists) {
      setStatus('installed');
      setDetail(`Found locally: ${REQUIRED_IMAGE}`);
      onImageReady?.(true);
    } else {
      setStatus('not_installed');
      setDetail(res?.message || `Missing locally: ${REQUIRED_IMAGE}`);
      onImageReady?.(false);
    }
  };

  const pullImage = async () => {
    setBusy(true);
    setDetail(null);
    try {
      const res = await api.pullDockerImage(REQUIRED_IMAGE);
      if (res?.ok) {
        setStatus('installed');
        setDetail(`Downloaded: ${REQUIRED_IMAGE}`);
        onImageReady?.(true);
      } else {
        setStatus('error');
        setDetail(res?.output || res?.message || 'Failed to download image');
        onImageReady?.(false);
      }
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (enabled) {
      setStatus('checking');
      checkImage();
    } else {
      setStatus('blocked');
      setDetail(null);
    }
  }, [enabled]);

  const isChecking = status === 'checking' || busy;
  const isInstalled = status === 'installed';
  const isMissing = status === 'not_installed';

  return (
    <section className={['step-card', enabled ? '' : 'step-card--disabled'].join(' ')}>
      <header className="step-header">
        <div className="step-meta">
          <span className="step-label">Step 2</span>
          <h1 className="step-title">Check Enclav image</h1>
        </div>
        <StatusPill
          status={
            isInstalled ? 'ok' : isMissing ? 'warn' : status === 'error' ? 'error' : enabled ? 'muted' : 'muted'
          }
          isChecking={isChecking}
          labels={
            !enabled
              ? 'Waiting for Docker'
              : isChecking
              ? 'Checking image…'
              : isInstalled
              ? 'Image is ready'
              : isMissing
              ? 'Image missing'
              : 'Could not verify image'
          }
        />
      </header>

      <p className="step-description">
        Enclav will run agents in containers based on the `{REQUIRED_IMAGE}` image. We’ll check if it’s already downloaded.
      </p>

      {!enabled && (
        <div className="info-banner info-banner--warning">
          <span>Complete Step 1 first.</span>
          <span className="info-banner-sub">Once Docker is installed and detected, we’ll check the required image.</span>
        </div>
      )}

      {enabled && isInstalled && (
        <div className="info-banner info-banner--success">
          <span>{REQUIRED_IMAGE} is available.</span>
          {detail && <span className="info-banner-sub">{detail}</span>}
        </div>
      )}

      {enabled && isMissing && (
        <div className="info-banner info-banner--warning">
          <span>{REQUIRED_IMAGE} is not downloaded yet.</span>
          {detail && <span className="info-banner-sub">{detail}</span>}
        </div>
      )}

      {enabled && status === 'error' && (
        <div className="info-banner info-banner--error">
          <span>We could not verify the image.</span>
          {detail && <span className="info-banner-sub">{detail}</span>}
        </div>
      )}

      <div className="step-actions">
        <button
          className="button button-primary"
          type="button"
          onClick={pullImage}
          disabled={!enabled || !canUseApi || isChecking || isInstalled}
        >
          {isInstalled ? 'Image Ready' : isChecking ? 'Working…' : 'Download enclav image'}
        </button>

        <button className="button button-ghost" type="button" onClick={checkImage} disabled={!enabled || isChecking}>
          {isChecking ? 'Checking…' : 'Re-check'}
        </button>
      </div>

      <footer className="step-footer">
        <span className="step-progress">2 of many simple steps</span>
        <span className="step-hint">If the image is missing, Enclav can download it for you.</span>
      </footer>
    </section>
  );
}

function AnthropicStep({ enabled, onAnthropicReady }) {
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState(enabled ? 'idle' : 'blocked');
  const [detail, setDetail] = useState(null);

  const isReady = status === 'saved';

  const saveKey = () => {
    const trimmed = apiKey.trim();
    if (!enabled || !trimmed) return;
    setStatus('saved');
    setDetail('Key will be written to the container when the gateway starts in Step 4.');
    onAnthropicReady?.(trimmed);
  };

  useEffect(() => {
    if (!enabled) {
      setStatus('blocked');
      setDetail(null);
    } else if (status === 'blocked') {
      setStatus('idle');
    }
  }, [enabled]);

  return (
    <section className={['step-card', enabled ? '' : 'step-card--disabled'].join(' ')}>
      <header className="step-header">
        <div className="step-meta">
          <span className="step-label">Step 3</span>
          <h1 className="step-title">Anthropic API Key</h1>
        </div>
        <StatusPill
          status={isReady ? 'ok' : status === 'error' ? 'error' : 'muted'}
          isChecking={false}
          labels={
            !enabled
              ? 'Waiting for image'
              : isReady
              ? 'Key saved'
              : status === 'error'
              ? 'Error saving key'
              : 'Key required'
          }
        />
      </header>

      <p className="step-description">
        Enter your Anthropic API key. It will be stored securely inside the container environment.
      </p>

      {!enabled && (
        <div className="info-banner info-banner--warning">
          <span>Complete Step 2 first.</span>
          <span className="info-banner-sub">Once the Enclav image is ready, you can configure your API key.</span>
        </div>
      )}

      {enabled && isReady && (
        <div className="info-banner info-banner--success">
          <span>Anthropic API key is configured.</span>
          {detail && <span className="info-banner-sub">{detail}</span>}
        </div>
      )}

      {enabled && status === 'error' && (
        <div className="info-banner info-banner--error">
          <span>Could not save the API key.</span>
          {detail && <span className="info-banner-sub">{detail}</span>}
        </div>
      )}

      {enabled && !isReady && (
        <div className="step-actions" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
          <input
            type="password"
            className="input"
            placeholder="sk-ant-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
          <div className="step-actions">
            <button
              className="button button-primary"
              type="button"
              onClick={saveKey}
              disabled={!enabled || !apiKey.trim()}
            >
              Save API Key
            </button>
          </div>
        </div>
      )}

      <footer className="step-footer">
        <span className="step-progress">3 of many simple steps</span>
        <span className="step-hint">Your key is written only to the container's local environment file.</span>
      </footer>
    </section>
  );
}

function GatewayStep({ enabled, apiKey, onGatewayReady }) {
  const [status, setStatus] = useState(enabled ? 'idle' : 'blocked');
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState(null);
  const [tokenError, setTokenError] = useState(null);
  const [approving, setApproving] = useState(false);
  const [approveResult, setApproveResult] = useState(null);

  const isReady = status === 'running';

  const checkGatewayStatus = async () => {
    if (!enabled) return;
    const api = window.enclav;
    if (!api || typeof api.checkGatewayStatus !== 'function') {
      setStatus('idle');
      setDetail('Cannot verify gateway status from this environment.');
      onGatewayReady?.(false);
      return;
    }

    setStatus('checking');
    setDetail(null);

    try {
      const res = await api.checkGatewayStatus();
      if (res?.running) {
        setStatus('running');
        setDetail('Gateway responded at http://127.0.0.1:18789/.');
        onGatewayReady?.(true);
        // try to fetch token once gateway is confirmed running
        void fetchToken();
      } else {
        setStatus('idle');
        setDetail(
          res?.status
            ? `Gateway responded with status ${res.status}.`
            : 'No response from gateway at http://127.0.0.1:18789/.'
        );
        onGatewayReady?.(false);
      }
    } catch (err) {
      setStatus('idle');
      setDetail('No response from gateway at http://127.0.0.1:18789/.');
      onGatewayReady?.(false);
    }
  };

  const startGateway = async () => {
    if (!enabled) return;
    const api = window.enclav;
    if (!api || typeof api.startOpenclawContainer !== 'function' || typeof api.runGateway !== 'function') {
      setStatus('error');
      setDetail('Gateway control is not available. Make sure you are running inside the Enclav desktop app.');
      onGatewayReady?.(false);
      return;
    }

    setBusy(true);
    setStatus('starting');
    setDetail(null);

    try {
      // Step 1: create/start the container (no gateway yet)
      const containerRes = await api.startOpenclawContainer();
      if (!containerRes?.ok) {
        setStatus('error');
        setDetail(containerRes?.message || 'Failed to start container.');
        onGatewayReady?.(false);
        return;
      }

      // Step 2: write the Anthropic API key into the container
      if (apiKey) {
        const envRes = await api.setAnthropicEnv(apiKey);
        if (!envRes?.ok) {
          setStatus('error');
          setDetail(envRes?.message || 'Failed to write Anthropic API key to container.');
          onGatewayReady?.(false);
          return;
        }
      }

      // Step 3: start the gateway inside the running container
      const res = await api.runGateway();
      if (res?.ok) {
        setStatus('running');
        setDetail('Container started, API key configured, and OpenClaw gateway launched.');
        onGatewayReady?.(true);
        setToken(null);
        setTokenError(null);
        void fetchToken();
      } else {
        setStatus('error');
        setDetail(res?.output || res?.message || 'Failed to start gateway');
        onGatewayReady?.(false);
      }
    } catch (err) {
      setStatus('error');
      setDetail(err instanceof Error ? err.message : 'Unexpected error');
      onGatewayReady?.(false);
    } finally {
      setBusy(false);
    }
  };

  const fetchToken = async () => {
    const api = window.enclav;
    if (!api || typeof api.getOpenclawToken !== 'function') {
      return;
    }

    try {
      const res = await api.getOpenclawToken();
      console.log('result', res);
      if (res?.ok && res.token) {
        setToken(res.token);
        setTokenError(null);
      } else if (res && !res.ok) {
        setToken(null);
        setTokenError(res.message || 'Could not read token from container.');
      }
    } catch (err) {
      setToken(null);
      setTokenError(err instanceof Error ? err.message : 'Could not read token from container.');
    }
  };

  const approveGatewayDevices = async () => {
    if (!enabled || !isReady) return;

    const api = window.enclav;
    if (!api || typeof api.approveOpenclawDevice !== 'function') {
      setApproveResult({ ok: false, message: 'OpenClaw approve API not available.' });
      return;
    }

    setApproving(true);
    setApproveResult(null);

    try {
      const res = await api.approveOpenclawDevice();
      if (res?.ok) {
        setApproveResult({ ok: true, message: res.output || 'Devices approved successfully.' });
      } else {
        setApproveResult({ ok: false, message: res?.output || res?.message || 'Failed to approve devices.' });
      }
    } catch (err) {
      setApproveResult({ ok: false, message: err instanceof Error ? err.message : 'Unexpected error approving devices.' });
    } finally {
      setApproving(false);
    }
  };

  const stopGateway = async () => {
    if (!enabled) return;
    const api = window.enclav;
    if (!api || typeof api.stopGateway !== 'function') {
      return;
    }

    setBusy(true);
    try {
      const res = await api.stopGateway();
      if (res?.ok) {
        setStatus('idle');
        setDetail('Stopped enclav-openclaw container.');
        onGatewayReady?.(false);
        setToken(null);
        setTokenError(null);
      } else {
        setStatus('error');
        setDetail(res?.output || res?.message || 'Failed to stop gateway');
        onGatewayReady?.(false);
      }
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!enabled) {
      setStatus('blocked');
      setDetail(null);
      onGatewayReady?.(false);
      return;
    }

    // When step becomes available (or re-entered), check actual gateway status via HTTP
    checkGatewayStatus();
  }, [enabled]);

  const isChecking = busy || status === 'starting';

  return (
    <section className={['step-card', enabled ? '' : 'step-card--disabled'].join(' ')}>
      <header className="step-header">
        <div className="step-meta">
          <span className="step-label">Step 3</span>
          <h1 className="step-title">Start OpenClaw gateway</h1>
        </div>
        <StatusPill
          status={
            !enabled
              ? 'muted'
              : isReady
              ? 'ok'
              : status === 'error'
              ? 'error'
              : status === 'starting'
              ? 'muted'
              : 'muted'
          }
          isChecking={isChecking}
          labels={
            !enabled
              ? 'Waiting for image'
              : isReady
              ? 'Gateway running'
              : status === 'error'
              ? 'Gateway error'
              : isChecking
              ? 'Starting gateway…'
              : 'Gateway not running'
          }
        />
      </header>

      <p className="step-description">
        This will run a container named <code>enclav-openclaw</code> from the <code>{REQUIRED_IMAGE}</code> image and
        start the OpenClaw gateway with <code>openclaw gateway run --bind lan</code>.
      </p>

      {!enabled && (
        <div className="info-banner info-banner--warning">
          <span>Complete Step 3 first.</span>
          <span className="info-banner-sub">We need your Anthropic API key before starting the gateway.</span>
        </div>
      )}

      {enabled && isReady && (
        <div className="info-banner info-banner--success">
          <span>OpenClaw gateway is running.</span>
          {detail && <span className="info-banner-sub">{detail}</span>}
        </div>
      )}

      {enabled && status === 'error' && (
        <div className="info-banner info-banner--error">
          <span>We could not start the gateway.</span>
          {detail && <span className="info-banner-sub">{detail}</span>}
        </div>
      )}

      {enabled && isReady && token && (
        <div className="info-banner info-banner--success">
          <span>Use this token in the OpenClaw UI when prompted:</span>
          <span className="info-banner-sub">
            <code>{token}</code>
          </span>
        </div>
      )}

      {enabled && isReady && !token && tokenError && (
        <div className="info-banner info-banner--warning">
          <span>Gateway is running, but we could not read the token automatically.</span>
          <span className="info-banner-sub">{tokenError}</span>
        </div>
      )}

      {enabled && isReady && approveResult && (
        <div
          className={`info-banner ${approveResult.ok ? 'info-banner--success' : 'info-banner--error'}`}>
          <span>{approveResult.ok ? 'Device approval succeeded.' : 'Device approval failed.'}</span>
          {approveResult.message && <span className="info-banner-sub">{approveResult.message}</span>}
        </div>
      )}

      <div className="step-actions">
        <button
          className="button button-primary"
          type="button"
          onClick={startGateway}
          disabled={!enabled || isChecking}
        >
          {isReady ? 'Restart gateway' : isChecking ? 'Working…' : 'Start gateway'}
        </button>
        <button
          className="button button-ghost"
          type="button"
          onClick={stopGateway}
          disabled={!enabled || isChecking || !isReady}
        >
          Stop gateway
        </button>
        <button
          className="button button-secondary"
          type="button"
          onClick={approveGatewayDevices}
          disabled={!enabled || !isReady || isChecking || approving}
        >
          {approving ? 'Approving…' : 'Approve devices'}
        </button>
        <button
          className="button button-success"
          type="button"
          onClick={() => window.open('http://127.0.0.1:18789/overview', '_blank', 'noopener,noreferrer')}
          disabled={!enabled || !isReady}
        >
          Open OpenClaw
        </button>
      </div>

      <footer className="step-footer">
        <span className="step-progress">4 of many simple steps</span>
        <span className="step-hint">Once the gateway is running, Enclav can talk to your local agents.</span>
      </footer>
    </section>
  );
}

export default function App() {
  const [dockerReady, setDockerReady] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const [anthropicKey, setAnthropicKey] = useState('');
  const anthropicReady = !!anthropicKey;
  const [gatewayReady, setGatewayReady] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const canGoNextFromStep1 = dockerReady;
  const canGoNextFromStep2 = imageReady;
  const canGoNextFromStep3 = anthropicReady;
  const canGoNextFromStep4 = gatewayReady;

  const handleNext = () => {
    if (currentStep === 1 && canGoNextFromStep1) {
      setCurrentStep(2);
    } else if (currentStep === 2 && canGoNextFromStep2) {
      setCurrentStep(3);
    } else if (currentStep === 3 && canGoNextFromStep3) {
      setCurrentStep(4);
    }
  };

  const handleBack = () => {
    if (currentStep === 2) {
      setCurrentStep(1);
    } else if (currentStep === 3) {
      setCurrentStep(2);
    } else if (currentStep === 4) {
      setCurrentStep(3);
    }
  };

  const totalSteps = 4;

  return (
    <div className="app-root">
      <main className="app-main">
        <div className="app-shell">
          <header className="app-header">
            <div className="app-logo-circle">E</div>
            <div className="app-header-text">
              <h1 className="app-title">Enclav</h1>
              <p className="app-subtitle">Zero-CLI AI agent deployments, one guided step at a time.</p>
            </div>
          </header>

          <div className="steps-nav">
            {[1, 2, 3, 4].map((step) => (
              <button
                key={step}
                type="button"
                className={[
                  'steps-nav-dot',
                  currentStep === step ? 'steps-nav-dot--active' : '',
                  (step === 2 && !dockerReady) ||
                    (step === 3 && !imageReady) ||
                    (step === 4 && !anthropicReady)
                    ? 'steps-nav-dot--locked'
                    : ''
                ].join(' ')}
                onClick={() => {
                  if (
                    step === 1 ||
                    (step === 2 && dockerReady) ||
                    (step === 3 && dockerReady && imageReady) ||
                    (step === 4 && dockerReady && imageReady && anthropicReady)
                  ) {
                    setCurrentStep(step);
                  }
                }}
              >
                <span className="steps-nav-dot-index">{step}</span>
              </button>
            ))}
          </div>

          <div className="steps-stack">
            {currentStep === 1 && <DockerStep onDockerReady={setDockerReady} />}
            {currentStep === 2 && <NodeImageStep enabled={dockerReady} onImageReady={setImageReady} />}
            {currentStep === 3 && <AnthropicStep enabled={imageReady} onAnthropicReady={setAnthropicKey} />}
            {currentStep === 4 && <GatewayStep enabled={anthropicReady} apiKey={anthropicKey} onGatewayReady={setGatewayReady} />}
          </div>

          <div className="wizard-nav">
            <button
              type="button"
              className="button button-ghost"
              onClick={handleBack}
              disabled={currentStep === 1}
            >
              Back
            </button>
            <span className="wizard-progress">
              Step {currentStep} of {totalSteps}
            </span>
            <button
              type="button"
              className="button button-primary"
              onClick={handleNext}
              disabled={
                (currentStep === 1 && !canGoNextFromStep1) ||
                (currentStep === 2 && !canGoNextFromStep2) ||
                (currentStep === 3 && !canGoNextFromStep3)
              }
            >
              {currentStep === totalSteps ? 'Continue' : 'Next'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

