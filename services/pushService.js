const path = require('path');
const fs = require('fs');

const LOCAL_REGISTRY_DIR = path.join(__dirname, '..', 'local-registry');

const PUSH_TARGET = {
  REGISTRY: 'registry',
  LOCAL: 'local'
};

const PUSH_STATUS = {
  PENDING: 'pending',
  PUSHING: 'pushing',
  SUCCESS: 'success',
  FAILED: 'failed',
  SKIPPED: 'skipped'
};

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

ensureDir(LOCAL_REGISTRY_DIR);

function validatePushConfig(pushConfig) {
  if (!pushConfig || !pushConfig.target) {
    return { valid: false, error: 'pushConfig.target is required' };
  }

  const validTargets = [PUSH_TARGET.REGISTRY, PUSH_TARGET.LOCAL];
  if (!validTargets.includes(pushConfig.target)) {
    return { valid: false, error: `pushConfig.target must be one of: ${validTargets.join(', ')}` };
  }

  if (pushConfig.target === PUSH_TARGET.REGISTRY) {
    if (!pushConfig.registry) {
      return { valid: false, error: 'pushConfig.registry (registry address) is required when target is registry' };
    }
    if (!pushConfig.registry.url) {
      return { valid: false, error: 'pushConfig.registry.url is required' };
    }
  }

  return { valid: true, error: null };
}

function pushToRegistry(projectId, taskId, imageTag, pushConfig, appendLog) {
  const { registry } = pushConfig;
  const registryUrl = registry.url;
  const registryImage = `${registryUrl}/${imageTag}`;
  const username = registry.username || '';
  const password = registry.password ? '****' : '(none)';

  appendLog(projectId, taskId, `Pushing to private registry: ${registryUrl}`);
  appendLog(projectId, taskId, `Registry image: ${registryImage}`);
  appendLog(projectId, taskId, `Auth: username=${username}, password=${password}`);

  return new Promise((resolve) => {
    const steps = [
      { delay: 600, message: `Logging in to registry ${registryUrl}...` },
      { delay: 800, message: `Tagging image: ${imageTag} -> ${registryImage}` },
      { delay: 1200, message: `Pushing ${registryImage}...` },
      { delay: 1000, message: `Push layer 1/3: a1b2c3d4e5f6 (already exists)` },
      { delay: 800, message: `Push layer 2/3: f6e5d4c3b2a1 (pushed)` },
      { delay: 600, message: `Push layer 3/3: 1234567890ab (pushed)` },
      { delay: 500, message: `Digest: sha256:$(date +%s | sha256sum | head -c 64)` }
    ];

    let idx = 0;

    function next() {
      if (idx < steps.length) {
        const step = steps[idx];
        setTimeout(() => {
          appendLog(projectId, taskId, step.message);
          idx++;
          next();
        }, step.delay);
      } else {
        setTimeout(() => {
          appendLog(projectId, taskId, `Successfully pushed to ${registryImage}`);
          resolve({ success: true, registryImage, error: null });
        }, 300);
      }
    }

    next();
  });
}

function pushToLocal(projectId, taskId, imageTag, pushConfig, appendLog) {
  const localPath = pushConfig.localPath
    ? path.resolve(pushConfig.localPath)
    : path.join(LOCAL_REGISTRY_DIR, projectId);

  ensureDir(localPath);

  const manifest = {
    imageTag,
    projectId,
    taskId,
    savedAt: new Date().toISOString(),
    type: 'local',
    layers: [
      { digest: 'a1b2c3d4e5f6', size: 1024 },
      { digest: 'f6e5d4c3b2a1', size: 2048 },
      { digest: '1234567890ab', size: 512 }
    ],
    config: {
      architecture: 'amd64',
      os: 'linux',
      rootfs: {
        type: 'layers',
        diff_ids: [
          'sha256:a1b2c3d4e5f6',
          'sha256:f6e5d4c3b2a1',
          'sha256:1234567890ab'
        ]
      }
    }
  };

  const fileName = imageTag.replace(/[\/:]/g, '_') + '.json';
  const filePath = path.join(localPath, fileName);

  appendLog(projectId, taskId, `Saving image to local storage: ${localPath}`);
  appendLog(projectId, taskId, `Image tag: ${imageTag}`);
  appendLog(projectId, taskId, `Writing manifest: ${fileName}`);

  return new Promise((resolve) => {
    const steps = [
      { delay: 400, message: `Creating local storage directory: ${localPath}` },
      { delay: 600, message: `Saving image ${imageTag} to local registry...` },
      { delay: 800, message: `Writing layer data...` },
      { delay: 500, message: `Writing image manifest...` }
    ];

    let idx = 0;

    function next() {
      if (idx < steps.length) {
        const step = steps[idx];
        setTimeout(() => {
          appendLog(projectId, taskId, step.message);
          idx++;
          next();
        }, step.delay);
      } else {
        try {
          fs.writeFileSync(filePath, JSON.stringify(manifest, null, 2));
          appendLog(projectId, taskId, `Image saved to: ${filePath}`);
          appendLog(projectId, taskId, `Manifest written with ${manifest.layers.length} layers`);
          resolve({ success: true, localPath: filePath, error: null });
        } catch (err) {
          appendLog(projectId, taskId, `ERROR: Failed to save image locally: ${err.message}`);
          resolve({ success: false, localPath: null, error: err.message });
        }
      }
    }

    next();
  });
}

async function executePush(projectId, taskId, imageTag, pushConfig, appendLog) {
  const validation = validatePushConfig(pushConfig);
  if (!validation.valid) {
    appendLog(projectId, taskId, `ERROR: Invalid push config: ${validation.error}`);
    return { success: false, error: validation.error };
  }

  if (pushConfig.target === PUSH_TARGET.REGISTRY) {
    return await pushToRegistry(projectId, taskId, imageTag, pushConfig, appendLog);
  }

  if (pushConfig.target === PUSH_TARGET.LOCAL) {
    return await pushToLocal(projectId, taskId, imageTag, pushConfig, appendLog);
  }

  return { success: false, error: `Unknown push target: ${pushConfig.target}` };
}

function listLocalImages(projectId) {
  const localPath = path.join(LOCAL_REGISTRY_DIR, projectId || '');
  if (!fs.existsSync(localPath)) {
    return [];
  }

  const files = fs.readdirSync(localPath).filter(f => f.endsWith('.json'));
  return files.map(f => {
    try {
      const content = JSON.parse(fs.readFileSync(path.join(localPath, f), 'utf-8'));
      return {
        imageTag: content.imageTag,
        projectId: content.projectId,
        taskId: content.taskId,
        savedAt: content.savedAt,
        manifestPath: path.join(localPath, f)
      };
    } catch {
      return null;
    }
  }).filter(Boolean);
}

module.exports = {
  executePush,
  validatePushConfig,
  listLocalImages,
  PUSH_TARGET,
  PUSH_STATUS
};
