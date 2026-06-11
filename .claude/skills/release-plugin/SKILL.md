---
name: release-plugin
description: 发布 DooTask CRM 插件新版本：确定版本号、更新中英双语 CHANGELOG、新建版本目录，提交后推 tag 触发 CI 构建并发布到 Docker Hub + DooTask 应用商店。用户要发版 / 出新版本 / 打 tag 时使用。
---

# 发布 DooTask CRM 插件

CRM 用**扁平布局**：项目根直接放 `config.yml` + `logo.svg` + `README*` + 每个版本一个目录（如 `0.1.0/`）+ `src/`（前端工程，Dockerfile 在 `src/Dockerfile`）+ `.build.yml`。镜像名 `dootask/crm`，路径 `/apps/crm`，appid `crm`。

发布靠**推送 tag** 触发 `.github/workflows/release.yml`：多架构（amd64+arm64）构建镜像推到 Docker Hub `dootask/crm`，再打包根目录元数据 + `<tag>/` 版本目录发布到 DooTask 应用商店。常规 push / PR 只跑 `ci.yml`（lint + build），不发布；光 `git tag` 不 push 也不会。

发布公开且不可逆，**推 tag 前必须和用户确认版本号与 CHANGELOG**；常规 git 操作（提交、推分支）可自行判断。

## ⚠️ 容易踩的坑

1. **Tag 不带 `v` 前缀**：版本号就是 `0.2.0` 这种纯数字。workflow 监听 `tags: '*'`，带 `v` 也会触发，但 Docker tag 由 `type=ref,event=tag` 取原始 ref 名——推 `v0.2.0` 会得到镜像 tag `v0.2.0`，和 AppStore/compose 的版本对不上。
2. **版本目录必须先提交再打 tag**：CI 打包的是 repo 里 `<tag>/` 这个真实目录（CRM 不像别的插件用 `1.0.0` 占位重命名）。发 `0.2.0` 就要先有并提交 `0.2.0/`，否则 CI 打包步骤直接报错退出。
3. **每个版本一个独立目录**：发新版是**新建 `<新版本>/` 目录**（从上一版复制），不是改旧目录。老版本目录留着无妨，CI 只打包当前 tag 的目录。
4. **AppStore 不允许重复版本号**：要发修复版必须递增（`0.1.0` → `0.1.1`）。误推的 tag 删了也撤不回已发布的 AppStore 版本。
5. **改装机配置 vs 改代码**：版本目录里的 `config.yml`/`nginx.conf`/`docker-compose.yml` 不进镜像、随 tar 包发布；`src/` 下任何改动要靠 CI 重建镜像才生效。compose 用 `${PLUGIN_VERSION}` 自动跟随版本，无需手改。

## 发布前准备

1. 在 `main`、工作区干净、与 `origin/main` 同步；待发布的改动先提交推上去。
2. 确认 `ci.yml` 在最新提交上是绿的（推 tag 不重跑 lint/build）：`gh run list --workflow=ci.yml --limit 3`。
3. 决定版本号并更新 CHANGELOG、新建版本目录（见下）。

## 发布流程

### 1. 决定版本号

```bash
cd /home/coder/workspaces/dootask-plugins/crm
git status                     # 工作区应干净、在 main 分支
ls -d */ | grep -E '^[0-9]'    # 看现有版本目录
git tag --sort=-creatordate | head   # 看已发版本
```

与用户确认新版本号，遵循 SemVer（不带 `v` 前缀）：patch=bugfix（`0.1.1`）、minor=新功能（`0.2.0`）、major=破坏性（`1.0.0`）；只增、不重复。

### 2. 新建版本目录（从上一版复制）

```bash
cp -r 0.1.0 0.2.0     # 用实际的上一版 / 新版号
```

`0.2.0/` 里的 `config.yml`、`docker-compose.yml`、`nginx.conf` 一般原样保留。只有当本次确有「装机配置字段 / 反代 / require_version」变化时才改对应文件。

### 3. 更新中英双语 CHANGELOG（覆盖式）

编辑 `0.2.0/CHANGELOG.md`（英文）和 `0.2.0/CHANGELOG_zh.md`（中文）。

- **覆盖式，不是追加**：整个文件替换成本次内容，不保留上一版条目（AppStore 自己维护历史）。文件里**不写版本号和日期**（版本由目录名 / tag 承载）。
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

### 4. （建议）发版前本地验证一遍

推 tag 前先本地构建确认镜像能起、资源能加载，避免把坏版本发到公开 AppStore：

```bash
bash /home/coder/.claude/skills/dootask-create-plugin/scripts/build_image.sh . 0.2.0
bash /home/coder/.claude/skills/dootask-create-plugin/scripts/deploy_to_test.sh . 0.2.0
```

验证抓手：`docker ps | grep crm`、`docker logs <容器>`、页面 `/apps/crm`，并**单独 curl 一个 `/apps/crm/assets/*.js`** 确认资源加载（页面 200 不代表资源能加载，见 CLAUDE.md）。

### 5. 提交版本目录 + CHANGELOG，推到 main

```bash
git add -A
git commit -m "release: 0.2.0"
git push origin main
```

确认本次提交的 `ci.yml` 跑绿：`gh run list --workflow=ci.yml --limit 1`。

### 6. 打 tag 推送，触发发布（不可逆）

```bash
git tag 0.2.0 && git push origin 0.2.0
```

推上去立即触发，没回头路。盯 Action：`gh run watch` 或 GitHub Actions 页。

### 7. 验证发布

- Docker Hub `dootask/crm` 出现新 tag（amd64+arm64）；
- DooTask 应用商店里 `crm`（客户关系管理）版本已更新；
- 让用户：DooTask 管理员 → 应用商店 → **更新应用列表** → 找到「客户关系管理」→ 更新到新版 → 强刷浏览器（Ctrl+Shift+R）。

## 发布失败时

- **Docker 登录失败**：secret 名 `DOCKER_USERNAME` / `DOCKER_PASSWORD`，多半过期或缺失；组织账号需为 `dootask`，否则镜像名不是 `dootask/crm`。
- **AppStore 发布失败**：查 `<tag>/config.yml`（尤其 `require_version`）和 `DOOTASK_USERNAME` / `DOOTASK_PASSWORD`；也可能是版本号重复。
- **打包步骤报「版本目录不存在」**：忘了先创建并提交 `<tag>/` 目录就打了 tag（见坑 2）。补建目录、提交、删旧 tag 重打。

发布依赖 4 个 Repository Secrets（仓库 Settings → Secrets and variables → Actions）：`DOOTASK_USERNAME`、`DOOTASK_PASSWORD`、`DOCKER_USERNAME`、`DOCKER_PASSWORD`，由管理员一次性配置，本技能不负责设置；登录类报错时提醒用户检查。
