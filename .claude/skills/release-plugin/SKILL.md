---
name: release-plugin
description: 发布 DooTask CRM 插件新版本：确定版本号、更新中英双语 CHANGELOG、新建版本目录、构建镜像并部署到测试目录（或推 tag 触发 CI）。用户要发版 / 出新版本 / 打 tag 时使用。
---

# 发布 DooTask CRM 插件

CRM 用**扁平布局**：项目根直接放 `config.yml` + `logo` + `README*` + 每个版本一个目录（如 `0.1.0/`）+ `src/`（前端工程）+ `.build.yml`。镜像名 `dootask/crm`，路径 `/apps/crm`。

> 本仓库目前**没有 GitHub 远程 / Actions / CI**，发布是「本地构建镜像 + 拷到主程序测试目录 + 在后台手动安装」。若以后接入了 CI（见末尾「接 CI 后」），改成推 tag 触发即可，CHANGELOG 规范不变。

## ⚠️ 容易踩的坑

1. **镜像 tag 必须等于版本号**：`docker-compose.yml` 里写的是 `dootask/crm:${PLUGIN_VERSION}`，安装时会替换成版本目录名。本地构建出的镜像 tag 不等于将要安装的版本，安装时就找不到镜像。
2. **改了前端/后端代码必须重建镜像**：版本目录里的 `config.yml`/`nginx.conf`/`docker-compose.yml` 不在镜像里，改它们不用重建；但 `src/` 下任何改动都要重建镜像才生效。
3. **每个版本一个独立目录**：发新版是**新建 `<新版本>/` 目录**（从上一版复制），不是改旧目录。`deploy_to_test.sh` 只拷目标版本目录，并排除其它版本目录。
4. **AppStore 不允许重复版本号**：要发修复版必须递增（`0.1.0` → `0.1.1`）。
5. 发布是面向使用者的动作，每一步**先和用户确认**版本号与 CHANGELOG 内容再操作。

## 发布流程

### 1. 确认状态干净、决定版本号

```bash
cd /home/coder/workspaces/dootask-plugins/crm
git status            # 工作区应干净、在 main 分支
ls -d */ | grep -E '^[0-9]'   # 看现有版本目录
```

与用户确认新版本号，遵循 SemVer（不带 `v` 前缀）：patch=bugfix（`0.1.1`）、minor=新功能（`0.2.0`）、major=破坏性（`1.0.0`）。

### 2. 新建版本目录（从上一版复制）

```bash
cp -r 0.1.0 0.2.0     # 用实际的上一版 / 新版号
```

`0.2.0/` 里的 `config.yml`、`docker-compose.yml`、`nginx.conf` 一般原样保留（compose 用 `${PLUGIN_VERSION}` 自动跟随版本，无需改）。只有当本次确有「装机配置字段 / 反代 / require_version」变化时才改对应文件。

### 3. 更新中英双语 CHANGELOG（覆盖式）

编辑 `0.2.0/CHANGELOG.md`（英文）和 `0.2.0/CHANGELOG_zh.md`（中文）。

- **覆盖式，不是追加**：整个文件替换成本次内容，不保留上一版条目（AppStore 自己维护历史）。文件里**不写版本号和日期**（版本由目录名/ tag 承载）。
- 按分类列点，只用本次涉及的分类。中英分类、条数、含义**严格一一对应**：

  | 英文 | 中文 |  | 英文 | 中文 |
  |---|---|---|---|---|
  | Added | 新增 |  | Changed | 变更 |
  | Fixed | 修复 |  | Improved | 优化 |
  | Updated | 更新 |  | Removed | 移除 |

- 一句话一条，**写给最终用户看**，不是开发者（说「新增客户跟进时间线」，不说「重构 follow_ups 表」）；涉及具体功能写出名字；保持简洁。

示例（按实际改动写）：

```markdown
### Added
- Added pagination to customer and opportunity lists.

### Fixed
- Fixed owner picker dismissing without saving.
```
```markdown
### 新增
- 客户与商机列表支持分页。

### 修复
- 修复负责人选择器关闭时未保存的问题。
```

### 4. 构建镜像（tag = 新版本号）

```bash
bash /home/coder/.claude/skills/dootask-create-plugin/scripts/build_image.sh . 0.2.0
# 等价于：docker build -t dootask/crm:0.2.0 -f src/Dockerfile src
docker images | grep dootask/crm     # 确认出现 0.2.0 tag
```

构建失败别跳过，定位 Dockerfile/依赖问题（常见：pnpm 版本，见根目录 CLAUDE.md）。

### 5. 部署到主程序测试目录

```bash
bash /home/coder/.claude/skills/dootask-create-plugin/scripts/deploy_to_test.sh . 0.2.0
# 默认拷到 /home/coder/workspaces/dootask/docker/appstore/apps/crm（含 config/logo/README/0.2.0/，排除 src 与 .build.yml）
```

### 6. 提交

```bash
git add -A
git commit -m "release: 0.2.0"
```

### 7. 给用户的安装指引（手动）

主程序不自动扫描。让用户：DooTask 管理员 → 应用商店 → **更新应用列表** → 找到「客户关系管理」→ 安装/更新到新版 → 强刷浏览器（Ctrl+Shift+R）。
验证抓手：`docker ps | grep crm`、`docker logs <容器>`、菜单路径 `/apps/crm`；并**单独 curl 一个 `/apps/crm/assets/*.js`** 确认资源加载（见 CLAUDE.md）。

## 验证发布

- `docker images | grep dootask/crm` 有新版本 tag；
- 测试目录 `ls .../apps/crm/` 含 `0.2.0/`、不含 `src/`；
- 起容器（最好前置一个 nginx 套用 `0.2.0/nginx.conf`）curl 页面、资源、`/apps/crm/api/me` 均 200。

## 接 CI 后（可选，当前未启用）

若以后给本仓库加了 GitHub 远程 + `.github/workflows/release.yml`（参考同目录其它插件，如 `mcp`），发布就变成：把 CHANGELOG 提交进 main → 打**不带 `v` 前缀**的 tag（`git tag 0.2.0 && git push origin 0.2.0`）→ CI 构建并发布到 Docker Hub + DooTask AppStore。届时本地 build/deploy 步骤交给 CI，CHANGELOG 与版本目录约定不变。注意 tag 一旦推送即触发、不可轻易撤回。
