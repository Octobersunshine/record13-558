const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { createBuildTask, getBuildTask, listBuildTasks } = require('../services/buildService');

const router = express.Router();

router.post('/', (req, res) => {
  const { imageVersion, baseImage, buildArgs } = req.body;

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
      imageVersion: task.imageVersion,
      baseImage: task.baseImage,
      status: task.status,
      createdAt: task.createdAt
    }
  });
});

router.get('/:taskId', (req, res) => {
  const { taskId } = req.params;
  const task = getBuildTask(taskId);

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

router.get('/', (req, res) => {
  const tasks = listBuildTasks();
  res.json({
    code: 200,
    message: 'success',
    data: tasks
  });
});

module.exports = router;
