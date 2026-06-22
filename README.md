# record13-558

Node.js 镜像自动化构建服务接口。

## 安装依赖

```bash
npm install
```

## 启动服务

```bash
npm start
```

服务默认运行在 `http://localhost:3000`

## API 接口

### 1. 健康检查

```
GET /health
```

### 2. 获取项目列表

```
GET /api/build/projects
```

### 3. 设置项目构建参数（项目级缓存，各项目隔离）

```
POST /api/build/args/:projectId
Content-Type: application/json

{
  "buildArgs": {
    "VERSION": "1.0.0",
    "ENV": "production",
    "APP_NAME": "my-app"
  }
}
```

### 4. 获取项目构建参数

```
GET /api/build/args/:projectId
```

### 5. 发起自动化构建任务

```
POST /api/build
Content-Type: application/json

{
  "projectId": "project-a",
  "imageVersion": "1.0.0",
  "baseImage": "node:18-alpine",
  "buildArgs": {
    "VERSION": "1.0.0",
    "ENV": "production"
  }
}
```

**参数说明：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| projectId | string | 是 | 项目ID（用于隔离不同项目的构建参数和上下文） |
| imageVersion | string | 是 | 镜像版本号 |
| baseImage | string | 是 | 基础镜像（如 node:18-alpine） |
| buildArgs | object | 否 | 构建参数（会与项目级缓存参数合并，本次请求优先） |

### 6. 查询构建任务状态

```
GET /api/build/:projectId/:taskId
```

### 7. 获取项目下所有构建任务

```
GET /api/build/:projectId
```

## 项目结构

```
.
├── index.js              # 项目入口
├── routes/
│   └── build.js          # 构建接口路由
├── services/
│   └── buildService.js   # 构建任务服务
├── builds/               # 构建上下文目录（按项目隔离）
│   └── {projectId}/
│       └── {taskId}/
│           └── Dockerfile
├── logs/                 # 构建日志目录（按项目隔离）
│   └── {projectId}/
│       └── {taskId}.log
└── package.json
```

## 隔离机制说明

- **项目级隔离**：每个 projectId 拥有独立的构建参数缓存、任务列表、日志目录、构建上下文
- **深拷贝防护**：所有 buildArgs 在存储和返回时均执行深拷贝，杜绝引用泄漏
- **参数合并策略**：构建任务参数 = 项目级缓存参数 + 本次请求参数（后者优先覆盖）
