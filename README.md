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

### 2. 发起自动化构建任务

```
POST /api/build
Content-Type: application/json

{
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
| imageVersion | string | 是 | 镜像版本号 |
| baseImage | string | 是 | 基础镜像（如 node:18-alpine） |
| buildArgs | object | 否 | 构建参数 |

### 3. 查询构建任务状态

```
GET /api/build/:taskId
```

### 4. 获取所有构建任务列表

```
GET /api/build
```

## 项目结构

```
.
├── index.js              # 项目入口
├── routes/
│   └── build.js          # 构建接口路由
├── services/
│   └── buildService.js   # 构建任务服务
├── logs/                 # 构建日志目录
└── package.json
```
