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

### 5. 查询支持的推送目标类型

```
GET /api/build/push-targets
```

### 6. 查询本地镜像存储列表

```
GET /api/build/local-images?projectId=xxx
```

### 7. 发起自动化构建任务

```
POST /api/build
Content-Type: application/json
```

**模式一：仅构建（不推送）**

```json
{
  "projectId": "project-a",
  "imageVersion": "1.0.0",
  "baseImage": "node:18-alpine",
  "buildArgs": { "VERSION": "1.0.0" }
}
```

**模式二：推送到私有仓库**

```json
{
  "projectId": "project-a",
  "imageVersion": "1.0.0",
  "baseImage": "node:18-alpine",
  "pushConfig": {
    "target": "registry",
    "registry": {
      "url": "harbor.example.com/my-project",
      "username": "admin",
      "password": "Harbor12345"
    }
  }
}
```

**模式三：保存到本地镜像存储**

```json
{
  "projectId": "project-a",
  "imageVersion": "1.0.0",
  "baseImage": "node:18-alpine",
  "pushConfig": {
    "target": "local",
    "localPath": "/data/images/project-a"
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
| pushConfig | object | 否 | 推送配置，不传则仅构建不推送 |
| pushConfig.target | string | 是* | 推送目标：`registry`（私有仓库）或 `local`（本地存储） |
| pushConfig.registry | object | 是* | 仓库配置（target=registry 时必填） |
| pushConfig.registry.url | string | 是 | 仓库地址（如 harbor.example.com/my-project） |
| pushConfig.registry.username | string | 否 | 仓库用户名 |
| pushConfig.registry.password | string | 否 | 仓库密码（存储时自动脱敏） |
| pushConfig.localPath | string | 否 | 本地存储路径（不传则使用默认路径 local-registry/{projectId}） |

### 8. 查询构建任务状态

```
GET /api/build/:projectId/:taskId
```

### 9. 获取项目下所有构建任务

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
│   ├── buildService.js   # 构建任务服务
│   └── pushService.js    # 推送服务（私有仓库 / 本地存储）
├── builds/               # 构建上下文目录（按项目隔离）
│   └── {projectId}/
│       └── {taskId}/
│           └── Dockerfile
├── local-registry/       # 本地镜像存储目录（按项目隔离）
│   └── {projectId}/
│       └── {imageTag}.json
├── logs/                 # 构建日志目录（按项目隔离）
│   └── {projectId}/
│       └── {taskId}.log
└── package.json
```

## 隔离机制说明

- **项目级隔离**：每个 projectId 拥有独立的构建参数缓存、任务列表、日志目录、构建上下文
- **深拷贝防护**：所有 buildArgs 在存储和返回时均执行深拷贝，杜绝引用泄漏
- **参数合并策略**：构建任务参数 = 项目级缓存参数 + 本次请求参数（后者优先覆盖）

## 推送控制说明

构建任务完成后可选择推送产物：

| 模式 | pushConfig.target | 说明 |
|------|-------------------|------|
| 仅构建 | 不传 pushConfig | 构建完成后不推送，pushStatus=skipped |
| 私有仓库 | `registry` | 推送到 Harbor / Docker Hub / ACR 等私有仓库 |
| 本地存储 | `local` | 将镜像 manifest 保存到本地目录 |

**任务状态流转**：`pending` → `building` → `pushing`（仅配置推送时）→ `success` / `failed`

**推送状态（pushStatus）**：`pending` → `pushing` → `success` / `failed` / `skipped`

**安全措施**：仓库密码在存储时自动脱敏为 `********`
