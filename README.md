# LabelScore

图像标注质量评估系统 | Image Annotation Quality Assessment System

## 简介

LabelScore 是一个用于评估图像标注结果质量的 Web 应用。它支持对单张或批量标注结果进行打分，帮助团队快速发现低质量标注，提升数据集的整体可靠性。

## 功能特点

- **单张评分**: 上传图像和标注文件，获取详细的质量评估报告
- **批量处理**: 批量评估多个标注文件，快速筛选低质量数据
- **多维度评估**: 从完整性、准确性、一致性等多个维度评估标注质量
- **问题检测**: 自动发现缺失标注、边界越界、标注重叠等问题

## 技术栈

**前端:**
- React 18 + TypeScript
- Vite
- React Router

**后端:**
- Python 3.10+
- FastAPI
- Pillow (图像处理)

## 项目结构

```
LabelScore/
├── frontend/                # 前端项目
│   ├── src/
│   │   ├── api/            # API 请求
│   │   ├── components/     # 通用组件
│   │   ├── hooks/          # 自定义 Hooks
│   │   ├── pages/          # 页面组件
│   │   ├── types/          # TypeScript 类型定义
│   │   ├── utils/          # 工具函数
│   │   └── assets/         # 静态资源
│   └── public/             # 公共资源
├── backend/                 # 后端项目
│   ├── app/
│   │   ├── api/routes/     # API 路由
│   │   ├── core/           # 核心配置
│   │   ├── models/         # 数据模型
│   │   ├── schemas/        # Pydantic 模式
│   │   ├── services/       # 业务逻辑
│   │   └── utils/          # 工具函数
│   └── tests/              # 测试文件
├── data/                    # 数据目录
│   ├── raw/                # 原始数据
│   └── processed/          # 处理后数据
└── scripts/                 # 脚本工具
```

## 快速开始

### 环境要求

- Node.js >= 18
- Python >= 3.10

### 后端启动

```bash
cd backend

# 创建虚拟环境
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 启动服务
uvicorn app.main:app --reload --port 8000
```

### 前端启动

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

访问 http://localhost:3000 即可使用应用。

## API 文档

启动后端服务后，访问 http://localhost:8000/docs 查看 Swagger API 文档。

### 主要接口

- `POST /api/score` - 单张图像标注评分
- `POST /api/score/batch` - 批量标注评分
- `GET /health` - 健康检查

## 支持的标注格式

- JSON (通用格式、LabelMe 格式)
- XML (PASCAL VOC 格式) - 计划支持

## License

MIT
