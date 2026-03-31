const { spawn } = require('child_process');

const children = [];
let shuttingDown = false;

function startProcess(name, script) {
  const command = process.platform === 'win32' ? 'cmd.exe' : 'npm';
  const args = process.platform === 'win32'
    ? ['/d', '/s', '/c', `npm run ${script}`]
    : ['run', script];

  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: false
  });

  child.on('exit', (code, signal) => {
    if (!shuttingDown) {
      shuttingDown = true;
      stopAll(signal || code);
    }
  });

  children.push({ name, child });
}

function stopAll(reason) {
  for (const entry of children) {
    if (!entry.child.killed) {
      entry.child.kill('SIGINT');
    }
  }

  setTimeout(() => {
    for (const entry of children) {
      if (!entry.child.killed) {
        entry.child.kill('SIGTERM');
      }
    }
  }, 1500);

  setTimeout(() => {
    process.exit(typeof reason === 'number' ? reason : 0);
  }, 2500);
}

process.on('SIGINT', () => {
  if (!shuttingDown) {
    shuttingDown = true;
    stopAll(0);
  }
});

process.on('SIGTERM', () => {
  if (!shuttingDown) {
    shuttingDown = true;
    stopAll(0);
  }
});

startProcess('status', 'status');
startProcess('dev', 'dev');
