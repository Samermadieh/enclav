const { app, BrowserWindow, ipcMain } = require('electron');
const { exec, spawn } = require('child_process');
const path = require('path');

let mainWindow;
const devServerUrl = process.env.VITE_DEV_SERVER_URL;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false
    }
  });

  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app
  .whenReady()
  .then(() => {
    // additional startup logic can go here
  })
  .then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Docker detection IPC, used by the React UI
ipcMain.handle('check-docker', async () => {
  return new Promise((resolve) => {
    exec('docker --version', (error, stdout, stderr) => {
      if (error) {
        resolve({
          installed: false,
          version: null,
          message: stderr || error.message
        });
        return;
      }

      resolve({
        installed: true,
        version: stdout.trim(),
        message: null
      });
    });
  });
});

ipcMain.handle('check-docker-image', async (_event, imageRef) => {
  const ref = typeof imageRef === 'string' ? imageRef.trim() : '';

  if (!ref) {
    return { exists: false, imageRef: String(imageRef), message: 'Missing image reference' };
  }

  return new Promise((resolve) => {
    exec(`docker image inspect ${JSON.stringify(ref)}`, { windowsHide: true }, (error, _stdout, stderr) => {
      if (error) {
        resolve({ exists: false, imageRef: ref, message: (stderr || error.message || '').trim() });
        return;
      }

      resolve({ exists: true, imageRef: ref, message: null });
    });
  });
});

ipcMain.handle('pull-docker-image', async (_event, imageRef) => {
  const ref = typeof imageRef === 'string' ? imageRef.trim() : '';

  if (!ref) {
    return { ok: false, imageRef: String(imageRef), output: '', message: 'Missing image reference' };
  }

  return new Promise((resolve) => {
    const child = spawn('docker', ['pull', 'samermadieh/enclav-openclaw'], { windowsHide: true });
    let output = '';

    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });

    child.on('error', (err) => {
      resolve({ ok: false, imageRef: ref, output, message: err.message });
    });

    child.on('close', (code) => {
      resolve({
        ok: code === 0,
        imageRef: ref,
        output: output.trim(),
        message: code === 0 ? null : `docker pull exited with code ${code}`
      });
    });
  });
});

ipcMain.handle('run-enclav-gateway', async () => {
  const containerName = 'enclav-openclaw';
  const gatewayCmd = 'openclaw gateway run --bind lan';

  const runExec = (cmd, args) =>
    new Promise((resolve) => {
      const child = spawn(cmd, args, { windowsHide: true });
      let output = '';

      child.stdout.on('data', (chunk) => {
        output += chunk.toString();
      });

      child.stderr.on('data', (chunk) => {
        output += chunk.toString();
      });

      child.on('error', (err) => {
        resolve({ ok: false, output, message: err.message });
      });

      child.on('close', (code) => {
        resolve({
          ok: code === 0,
          output: output.trim(),
          message: code === 0 ? null : `${cmd} exited with code ${code}`
        });
      });
    });

  // Check if container exists
  const existsResult = await runExec('docker', [
    'ps',
    '-a',
    '--filter',
    `name=${containerName}`,
    '--format',
    '{{.ID}}'
  ]);

  const exists =
    existsResult.ok && existsResult.output && existsResult.output.split('\n').filter(Boolean).length > 0;

  if (!exists) {
    // Create and start new container running the gateway command
    const runResult = await runExec('docker', [
      'run',
      '-d',
      '--name',
      containerName,
      '-p',
      '127.0.0.1:18789:18789',
      'samermadieh/enclav-openclaw',
      'sh',
      '-lc',
      gatewayCmd
    ]);

    return {
      ok: runResult.ok,
      output: runResult.output,
      message: runResult.message,
      createdNew: true
    };
  }

  // Container exists; ensure it's running and (re)start gateway
  await runExec('docker', ['start', containerName]);
  const execResult = await runExec('docker', [
    'exec',
    '-d',
    containerName,
    'sh',
    '-lc',
    gatewayCmd
  ]);

  return {
    ok: execResult.ok,
    output: execResult.output,
    message: execResult.message,
    createdNew: false
  };
});

ipcMain.handle('check-gateway-status', async () => {
  try {
    const res = await fetch('http://127.0.0.1:18789/', { method: 'GET' });
    if (res.ok) {
      return { running: true, status: res.status };
    }
    return { running: false, status: res.status };
  } catch (err) {
    return { running: false, status: null, message: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle('stop-enclav-gateway', async () => {
  const containerName = 'enclav-openclaw';

  return new Promise((resolve) => {
    const child = spawn('docker', ['stop', containerName], { windowsHide: true });
    let output = '';

    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });

    child.on('error', (err) => {
      resolve({ ok: false, output, message: err.message });
    });

    child.on('close', (code) => {
      resolve({
        ok: code === 0,
        output: output.trim(),
        message: code === 0 ? null : `docker stop exited with code ${code}`
      });
    });
  });
});

ipcMain.handle('approve-openclaw-device', async () => {
  const containerName = 'enclav-openclaw';

  return new Promise((resolve) => {
    const child = spawn(
      'docker',
      ['exec', containerName, 'sh', '-lc', 'openclaw devices approve'],
      { windowsHide: true }
    );

    let output = '';
    let errorOutput = '';

    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      errorOutput += chunk.toString();
    });

    child.on('error', (err) => {
      resolve({ ok: false, output, message: err.message });
    });

    child.on('close', (code) => {
      resolve({
        ok: code === 0,
        output: (output || errorOutput).trim(),
        message: code === 0 ? null : (errorOutput || `docker exec exited with code ${code}`).trim()
      });
    });
  });
});

ipcMain.handle('start-openclaw-container', async () => {
  const containerName = 'enclav-openclaw';

  const runExec = (cmd, args) =>
    new Promise((resolve) => {
      const child = spawn(cmd, args, { windowsHide: true });
      let output = '';
      let errorOutput = '';

      child.stdout.on('data', (chunk) => {
        output += chunk.toString();
      });
      child.stderr.on('data', (chunk) => {
        errorOutput += chunk.toString();
      });
      child.on('error', (err) => {
        resolve({ ok: false, output, message: err.message });
      });
      child.on('close', (code) => {
        resolve({
          ok: code === 0,
          output: (output || errorOutput).trim(),
          message: code === 0 ? null : (errorOutput || `${cmd} exited with code ${code}`).trim()
        });
      });
    });

  try {
    const existsResult = await runExec('docker', [
      'ps',
      '-a',
      '--filter',
      `name=${containerName}`,
      '--format',
      '{{.ID}}'
    ]);

    const exists = existsResult.ok && existsResult.output.split('\n').filter(Boolean).length > 0;
    if (!exists) {
      const createResult = await runExec('docker', [
        'run',
        '-d',
        '--name',
        containerName,
        '-p',
        '127.0.0.1:18789:18789',
        'samermadieh/enclav-openclaw',
        'sh',
        '-c',
        'while sleep 3600; do :; done'
      ]);

      if (!createResult.ok) {
        return { ok: false, output: createResult.output, message: createResult.message || 'Failed to create container.' };
      }
      return { ok: true, output: createResult.output, message: 'Container created and started.' };
    }

    const runningResult = await runExec('docker', [
      'ps',
      '--filter',
      `name=${containerName}`,
      '--format',
      '{{.ID}}'
    ]);

    const running = runningResult.ok && runningResult.output.split('\n').filter(Boolean).length > 0;
    if (!running) {
      const startResult = await runExec('docker', ['start', containerName]);
      if (!startResult.ok) {
        return { ok: false, output: startResult.output, message: startResult.message || 'Failed to start container.' };
      }
      return { ok: true, output: startResult.output, message: 'Container started.' };
    }

    return { ok: true, output: 'Container is already running.', message: null };
  } catch (err) {
    return { ok: false, output: '', message: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle('set-anthropic-env', async (_event, apiKey) => {
  const containerName = 'enclav-openclaw';
  const key = typeof apiKey === 'string' ? apiKey.trim() : '';

  if (!key) {
    return { ok: false, output: '', message: 'Anthropic API key is required.' };
  }

  const runExec = (cmd, args) =>
    new Promise((resolve) => {
      const child = spawn(cmd, args, { windowsHide: true });
      let output = '';
      let errorOutput = '';

      child.stdout.on('data', (chunk) => {
        output += chunk.toString();
      });
      child.stderr.on('data', (chunk) => {
        errorOutput += chunk.toString();
      });
      child.on('error', (err) => {
        resolve({ ok: false, output, message: err.message });
      });
      child.on('close', (code) => {
        resolve({
          ok: code === 0,
          output: (output || errorOutput).trim(),
          message: code === 0 ? null : (errorOutput || `${cmd} exited with code ${code}`).trim()
        });
      });
    });

  try {
    const result = await runExec('docker', [
      'exec',
      containerName,
      'sh',
      '-lc',
      `mkdir -p ~/.openclaw && printf 'ANTHROPIC_API_KEY=%s\\n' ${key} > ~/.openclaw/.env`
    ]);

    if (!result.ok) {
      return { ok: result.ok, output: result.output, message: result.message };
    }

    const modelResult = await runExec('docker', [
      'exec',
      containerName,
      'sh',
      '-lc',
      'openclaw models set anthropic/claude-haiku-4-5'
    ]);

    return {
      ok: modelResult.ok,
      output: modelResult.output,
      message: modelResult.message
    };
  } catch (err) {
    return { ok: false, output: '', message: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle('get-openclaw-token', async () => {
  const containerName = 'enclav-openclaw';

  const runExec = (cmd, args) =>
    new Promise((resolve) => {
      const child = spawn(cmd, args, { windowsHide: true });
      let output = '';
      let errorOutput = '';
      child.stdout.on('data', (chunk) => { output += chunk.toString(); });
      child.stderr.on('data', (chunk) => { errorOutput += chunk.toString(); });
      child.on('error', (err) => { resolve({ ok: false, output, message: err.message }); });
      child.on('close', (code) => {
        resolve({
          ok: code === 0,
          output: (output || errorOutput).trim(),
          message: code === 0 ? null : (errorOutput || `${cmd} exited with code ${code}`).trim()
        });
      });
    });

  const doctorResult = await runExec('docker', [
    'exec',
    containerName,
    'sh',
    '-lc',
    'openclaw doctor --generate-gateway-token --non-interactive'
  ]);

  if (!doctorResult.ok) {
    return { ok: false, token: null, message: doctorResult.message };
  }

  return new Promise((resolve) => {
    const child = spawn(
      'docker',
      ['exec', containerName, 'sh', '-lc', 'cat ~/.openclaw/openclaw.json'],
      { windowsHide: true }
    );

    let output = '';
    let errorOutput = '';

    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      errorOutput += chunk.toString();
    });

    child.on('error', (err) => {
      resolve({ ok: false, token: null, message: err.message });
    });

    child.on('close', (code) => {
      if (code !== 0) {
        resolve({
          ok: false,
          token: null,
          message: (errorOutput || `docker exec exited with code ${code}`).trim()
        });
        return;
      }

      try {
        const parsed = JSON.parse(output);
        const token =
          parsed &&
          parsed.gateway &&
          parsed.gateway.auth &&
          parsed.gateway.auth.mode === 'token' &&
          typeof parsed.gateway.auth.token === 'string' &&
          parsed.gateway.auth.token;

        if (!token) {
          resolve({
            ok: false,
            token: null,
            message: 'Could not find token in ~/.openclaw/openclaw.json'
          });
        } else {
          resolve({ ok: true, token, message: null });
        }
      } catch (err) {
        resolve({
          ok: false,
          token: null,
          message: err instanceof Error ? err.message : 'Failed to parse openclaw.json'
        });
      }
    });
  });
});

