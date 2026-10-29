# Job Scout

浏览器职位收集、简历分配和申请跟踪工具，支持使用者自备 OpenAI API key。

[English](README.md) · [API 配置](docs/setup.md) · [架构说明](docs/architecture.md)

## 当前版本

v0.6.1 原型。规则匹配、模拟 API／抓取测试和本地浏览器模拟流程已通过；真实 OpenAI 调用及真实 LinkedIn 页面仍需验证。界面、提示和模型解释使用英文；README 保留中英双语。

- 读取已打开的 LinkedIn 职位，或手动粘贴 JD。
- 扫描已加载的相关职位卡片，检查职位 ID 和描述稳定性。
- 推荐 DS、DA、Research 简历版本。
- API 模式拆分必需／加分／不明确要求，并展示 JD 和简历原文依据。
- 保存申请状态，导出 JSON／CSV。

**不会自动投递或改写简历。** 规则模式目前采用通用示例岗位词表；API 模式使用每位用户自己填写的简历与偏好。关键词百分比不等于录用概率或可靠的岗位适配评分。

## 安装

1. 下载并解压仓库。
2. 打开 Chrome／Edge 扩展管理页，启用开发者模式。
3. 点击“加载已解压的扩展程序”，选择含 `manifest.json` 的文件夹。
4. 在 LinkedIn Jobs 页面读取职位，或粘贴完整 JD 后分析并保存。

规则模式无需 API key 或后端。批量扫描只处理当前已经加载的卡片，不自动翻页。

## API 模式

需要 Node.js 22+ 和自己的 OpenAI API 账户：

1. 把 `.env.example` 复制为 `.env`。
2. 配置 `OPENAI_API_KEY` 和支持 Responses／Structured Outputs 的 `OPENAI_MODEL`。
3. 用下列命令生成 `JOB_SCOUT_TOKEN`：

   ```sh
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

4. 运行 `npm start`。
5. 在插件 API 设置中填写连接令牌和简历正文。**OpenAI 密钥只留在后端，不填写在插件中。**
6. 确认当前 JD 完整和发送范围，再点击“Analyze job with OpenAI”。

每次点击分析一条，费用由使用者的 API 账户承担。不自动重试、不自动调用模型处理扫描列表。本机连接检查不会调用 OpenAI，也不能证明密钥有效。

资料保存在浏览器本地；API 分析时会发送当前职位名称、JD、填写的简历和偏好。导出文件可能包含简历摘录，请勿公开。

## 测试

运行 `npm test`。测试使用合成数据和模拟模型返回，不消耗 API 额度。

详细功能、限制与后续计划见 [英文首页](README.md)。

