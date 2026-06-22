const express = require('express');
const { v4: uuidv4 } = require('uuid');
const {
  createBuildTask,
  getBuildTask,
  listBuildTasks,
  listAllProjects,
  setProjectBuildArgs,
  getProjectBuildArgs
} = require('../services/buildService');

const router = express.Router();

router.get('/projects', (req, res) => {
  const projects = listAllProjects();
  res.json({
    code: 200,
    message: 'success',
    data: projects
  });
});

router.post('/args/:projectId', (req, res) => {
  const { projectId } = req.params;
  const { buildArgs } = req.body;

  if (!buildArgs || typeof buildArgs !== 'object') {
    return res.status(400).json({
      code: 400,
      message: 'buildArgs must be a valid object',
      data: null
    });
  }

  setProjectBuildArgs(projectId, buildArgs);

  res.json({
    code: 200,
    message: 'Project build args set successfully',
    data: {
      projectId,
      buildArgs: getProjectBuildArgs(projectId)
    }
  });
});

router.get('/args/:projectId', (req, res) => {
  const { projectId } = req.params;
  const buildArgs = getProjectBuildArgs(projectId);

  res.json({
    code: 200,
    message: 'success',
    data: {
      projectId,
      buildArgs
    }
  });
});

router.post('/', (req, res) => {
  const { projectId, imageVersion, baseImage, buildArgs } = req.body;

  if (!projectId) {
    return res.status(400).json({
      code: 400,
      message: 'projectId (项目ID) is required',
      data: null
    });
  }

  if (!imageVersion) {
    return res.status(400).json({
      code: 400,
      message: 'imageVersion (镜像版本) is required',
      data: null
    });
  }

  if (!baseImage) {
    return res.status(400).json({
      code: 400,
      message: 'baseImage (基础镜像) is required',
      data: null
    });
  }

  const taskId = uuidv4();
  const task = createBuildTask({
    projectId,
    taskId,
    imageVersion,
    baseImage,
    buildArgs: buildArgs || {}
  });

  res.status(202).json({
    code: 202,
    message: 'Build task created successfully',
    data: {
      taskId: task.taskId,
      projectId: task.projectId,
      imageVersion: task.imageVersion,
      baseImage: task.baseImage,
      status: task.status,
      createdAt: task.createdAt
    }
  });
});

router.get('/:projectId/:taskId', (req, res) => {
  const { projectId, taskId } = req.params;
  const task = getBuildTask(projectId, taskId);

  if (!task) {
    return res.status(404).json({
      code: 404,
      message: 'Build task not found',
      data: null
    });
  }

  res.json({
    code: 200,
    message: 'success',
    data: task
  });
});

router.get('/:projectId', (req, res) => {
  const { projectId } = req.params;
  const tasks = listBuildTasks(projectId);

  res.json({
    code: 200,
    message: 'success',
    data: tasks
  });
});

module.exports = router;
