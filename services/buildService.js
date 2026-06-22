const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const projectCache = new Map();

const BUILD_STATUS = {
  PENDING: 'pending',
  BUILDING: 'building',
  SUCCESS: 'success',
  FAILED: 'failed'
};

const BUILDS_DIR = path.join(__dirname, '..', 'builds');
const LOGS_DIR = path.join(__dirname, '..', 'logs');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

ensureDir(BUILDS_DIR);
ensureDir(LOGS_DIR);

function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(item => deepClone(item));
  const cloned = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  return cloned;
}

function getProjectData(projectId) {
  if (!projectCache.has(projectId)) {
    projectCache.set(projectId, {
      tasks: new Map(),
      buildArgsCache: {},
      createdAt: new Date().toISOString()
    });
    const projectBuildDir = path.join(BUILDS_DIR, projectId);
    const projectLogDir = path.join(LOGS_DIR, projectId);
    ensureDir(projectBuildDir);
    ensureDir(projectLogDir);
  }
  return projectCache.get(projectId);
}

function getLogPath(projectId, taskId) {
  return path.join(LOGS_DIR, projectId, `${taskId}.log`);
}

function getBuildContextPath(projectId, taskId) {
  return path.join(BUILDS_DIR, projectId, taskId);
}

function appendLog(projectId, taskId, message) {
  const logPath = getLogPath(projectId, taskId);
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(logPath, logLine);
}

function readLogs(projectId, taskId) {
  const logPath = getLogPath(projectId, taskId);
  if (!fs.existsSync(logPath)) {
    return '';
  }
  return fs.readFileSync(logPath, 'utf-8');
}

function mergeWithDefaults(projectId, buildArgs) {
  const projectData = getProjectData(projectId);
  const defaults = deepClone(projectData.buildArgsCache);
  const provided = deepClone(buildArgs || {});
  return { ...defaults, ...provided };
}

function setProjectBuildArgs(projectId, buildArgs) {
  const projectData = getProjectData(projectId);
  projectData.buildArgsCache = deepClone(buildArgs);
}

function getProjectBuildArgs(projectId) {
  const projectData = getProjectData(projectId);
  return deepClone(projectData.buildArgsCache);
}

function createBuildTask({ projectId, taskId, imageVersion, baseImage, buildArgs }) {
  const projectData = getProjectData(projectId);
  const mergedArgs = mergeWithDefaults(projectId, buildArgs);

  const task = {
    projectId,
    taskId,
    imageVersion,
    baseImage,
    buildArgs: mergedArgs,
    status: BUILD_STATUS.PENDING,
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    error: null
  };

  projectData.tasks.set(taskId, task);

  appendLog(projectId, taskId, `Build task created: ${taskId}`);
  appendLog(projectId, taskId, `Project: ${projectId}`);
  appendLog(projectId, taskId, `Image version: ${imageVersion}`);
  appendLog(projectId, taskId, `Base image: ${baseImage}`);
  appendLog(projectId, taskId, `Merged build args: ${JSON.stringify(mergedArgs)}`);

  setImmediate(() => executeBuildTask(projectId, taskId));

  return deepClone(task);
}

function executeBuildTask(projectId, taskId) {
  const projectData = getProjectData(projectId);
  const task = projectData.tasks.get(taskId);
  if (!task) return;

  task.status = BUILD_STATUS.BUILDING;
  task.startedAt = new Date().toISOString();
  appendLog(projectId, taskId, 'Build task started...');

  const dockerfileContent = generateDockerfile(task.baseImage, task.buildArgs);
  const buildContext = getBuildContextPath(projectId, taskId);
  const dockerfilePath = path.join(buildContext, 'Dockerfile');

  try {
    ensureDir(buildContext);
    fs.writeFileSync(dockerfilePath, dockerfileContent);
    appendLog(projectId, taskId, `Dockerfile generated at: ${dockerfilePath}`);
    appendLog(projectId, taskId, `Dockerfile content:\n${dockerfileContent}`);
  } catch (err) {
    task.status = BUILD_STATUS.FAILED;
    task.completedAt = new Date().toISOString();
    task.error = `Failed to generate Dockerfile: ${err.message}`;
    appendLog(projectId, taskId, `ERROR: ${task.error}`);
    return;
  }

  const imageTag = `${task.baseImage.split(':')[0]}:${task.imageVersion}`;
  appendLog(projectId, taskId, `Target image tag: ${imageTag}`);
  appendLog(projectId, taskId, 'Running docker build process...');

  const buildProcess = runDockerBuild(projectId, task, buildContext, imageTag);

  buildProcess.on('close', (code) => {
    if (code === 0) {
      task.status = BUILD_STATUS.SUCCESS;
      appendLog(projectId, taskId, 'Build completed successfully!');
      appendLog(projectId, taskId, `Image built: ${imageTag}`);
    } else {
      task.status = BUILD_STATUS.FAILED;
      task.error = `Build process exited with code ${code}`;
      appendLog(projectId, taskId, `ERROR: ${task.error}`);
    }
    task.completedAt = new Date().toISOString();
  });
}

function runDockerBuild(projectId, task, buildContext, imageTag) {
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
        appendLog(projectId, taskId, stage.message);
        stageIndex++;
        runNextStage();
      }, stage.delay);
    } else {
      setTimeout(() => {
        appendLog(projectId, taskId, `Successfully tagged ${imageTag}`);
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

function getBuildTask(projectId, taskId) {
  const projectData = getProjectData(projectId);
  const task = projectData.tasks.get(taskId);
  if (!task) return null;
  return {
    ...deepClone(task),
    logs: readLogs(projectId, taskId)
  };
}

function listBuildTasks(projectId) {
  const projectData = getProjectData(projectId);
  return Array.from(projectData.tasks.values())
    .map(task => deepClone(task))
    .map(task => ({
      taskId: task.taskId,
      projectId: task.projectId,
      imageVersion: task.imageVersion,
      baseImage: task.baseImage,
      status: task.status,
      createdAt: task.createdAt,
      startedAt: task.startedAt,
      completedAt: task.completedAt
    }));
}

function listAllProjects() {
  return Array.from(projectCache.keys()).map(projectId => ({
    projectId,
    taskCount: projectCache.get(projectId).tasks.size,
    createdAt: projectCache.get(projectId).createdAt
  }));
}

module.exports = {
  createBuildTask,
  getBuildTask,
  listBuildTasks,
  listAllProjects,
  setProjectBuildArgs,
  getProjectBuildArgs,
  BUILD_STATUS
};
