const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const buildTasks = new Map();

const BUILD_STATUS = {
  PENDING: 'pending',
  BUILDING: 'building',
  SUCCESS: 'success',
  FAILED: 'failed'
};

const LOGS_DIR = path.join(__dirname, '..', 'logs');

if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

function getLogPath(taskId) {
  return path.join(LOGS_DIR, `${taskId}.log`);
}

function appendLog(taskId, message) {
  const logPath = getLogPath(taskId);
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(logPath, logLine);
}

function readLogs(taskId) {
  const logPath = getLogPath(taskId);
  if (!fs.existsSync(logPath)) {
    return '';
  }
  return fs.readFileSync(logPath, 'utf-8');
}

function createBuildTask({ taskId, imageVersion, baseImage, buildArgs }) {
  const task = {
    taskId,
    imageVersion,
    baseImage,
    buildArgs,
    status: BUILD_STATUS.PENDING,
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    error: null
  };

  buildTasks.set(taskId, task);
  appendLog(taskId, `Build task created: ${taskId}`);
  appendLog(taskId, `Image version: ${imageVersion}`);
  appendLog(taskId, `Base image: ${baseImage}`);
  appendLog(taskId, `Build args: ${JSON.stringify(buildArgs)}`);

  setImmediate(() => executeBuildTask(taskId));

  return task;
}

function executeBuildTask(taskId) {
  const task = buildTasks.get(taskId);
  if (!task) return;

  task.status = BUILD_STATUS.BUILDING;
  task.startedAt = new Date().toISOString();
  appendLog(taskId, 'Build task started...');

  const dockerfileContent = generateDockerfile(task.baseImage, task.buildArgs);
  const buildContext = path.join(LOGS_DIR, taskId);
  const dockerfilePath = path.join(buildContext, 'Dockerfile');

  try {
    if (!fs.existsSync(buildContext)) {
      fs.mkdirSync(buildContext, { recursive: true });
    }
    fs.writeFileSync(dockerfilePath, dockerfileContent);
    appendLog(taskId, `Dockerfile generated at: ${dockerfilePath}`);
    appendLog(taskId, `Dockerfile content:\n${dockerfileContent}`);
  } catch (err) {
    task.status = BUILD_STATUS.FAILED;
    task.completedAt = new Date().toISOString();
    task.error = `Failed to generate Dockerfile: ${err.message}`;
    appendLog(taskId, `ERROR: ${task.error}`);
    return;
  }

  const imageTag = `${task.baseImage.split(':')[0]}:${task.imageVersion}`;
  appendLog(taskId, `Target image tag: ${imageTag}`);
  appendLog(taskId, 'Simulating docker build process...');

  const buildProcess = simulateDockerBuild(task, buildContext, imageTag);

  buildProcess.on('close', (code) => {
    if (code === 0) {
      task.status = BUILD_STATUS.SUCCESS;
      appendLog(taskId, 'Build completed successfully!');
      appendLog(taskId, `Image built: ${imageTag}`);
    } else {
      task.status = BUILD_STATUS.FAILED;
      task.error = `Build process exited with code ${code}`;
      appendLog(taskId, `ERROR: ${task.error}`);
    }
    task.completedAt = new Date().toISOString();
  });
}

function simulateDockerBuild(task, buildContext, imageTag) {
  const taskId = task.taskId;

  const stages = [
    { delay: 800, message: 'Step 1/5: FROM ' + task.baseImage },
    { delay: 1200, message: 'Step 2/5: Setting up build environment' },
    { delay: 1000, message: 'Step 3/5: Copying application files' },
    { delay: 1500, message: 'Step 4/5: Running build commands' },
    { delay: 800, message: 'Step 5/5: Applying image version tag: ' + task.imageVersion }
  ];

  let stageIndex = 0;

  function runNextStage() {
    if (stageIndex < stages.length) {
      const stage = stages[stageIndex];
      setTimeout(() => {
        appendLog(taskId, stage.message);
        stageIndex++;
        runNextStage();
      }, stage.delay);
    } else {
      setTimeout(() => {
        appendLog(taskId, `Successfully tagged ${imageTag}`);
        if (processListeners.close) {
          processListeners.close(0);
        }
      }, 500);
    }
  }

  const processListeners = {};

  setTimeout(runNextStage, 300);

  return {
    on: (event, callback) => {
      if (event === 'close') {
        processListeners.close = callback;
      }
    }
  };
}

function generateDockerfile(baseImage, buildArgs) {
  let dockerfile = `FROM ${baseImage}\n\n`;

  if (buildArgs && Object.keys(buildArgs).length > 0) {
    Object.entries(buildArgs).forEach(([key, value]) => {
      dockerfile += `ARG ${key}=${value}\n`;
    });
    dockerfile += '\n';
  }

  dockerfile += `LABEL version="${buildArgs.VERSION || 'latest'}"\n`;
  dockerfile += `LABEL maintainer="build-service"\n`;
  dockerfile += `LABEL base.image="${baseImage}"\n\n`;
  dockerfile += `WORKDIR /app\n\n`;
  dockerfile += `COPY . .\n\n`;
  dockerfile += `RUN echo "Build completed at $(date)"\n`;

  return dockerfile;
}

function getBuildTask(taskId) {
  const task = buildTasks.get(taskId);
  if (!task) return null;
  return {
    ...task,
    logs: readLogs(taskId)
  };
}

function listBuildTasks() {
  return Array.from(buildTasks.values()).map(task => ({
    taskId: task.taskId,
    imageVersion: task.imageVersion,
    baseImage: task.baseImage,
    status: task.status,
    createdAt: task.createdAt,
    startedAt: task.startedAt,
    completedAt: task.completedAt
  }));
}

module.exports = {
  createBuildTask,
  getBuildTask,
  listBuildTasks,
  BUILD_STATUS
};
