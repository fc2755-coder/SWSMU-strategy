# SWSMU Strategy DashBoard

申万菱信策略数据看板 —— 行业比较 Dashboard

## 访问地址

https://fc2755-coder.github.io/SWSMU-strategy/

## 架构

```
SWSMU-strategy/
├── index.html          # 主页面（静态骨架 + 数据加载器）
├── app.js              # 前端渲染逻辑（ECharts）
├── echarts.min.js      # ECharts 库
├── data/               # 数据文件（JSON，每次更新只需替换这里）
│   ├── meta.json       # 元信息（更新时间戳）
│   ├── valuation.json  # 估值数据（PE/PB/ROE）
│   ├── earnings.json   # 盈利数据（增速/二阶导）
│   ├── sentiment.json  # 情绪数据（ERP/行业情绪/风格/持仓）
│   ├── macro_cn.json   # 国内宏观
│   ├── liquidity.json  # 资金面（私募/两融/ETF）
│   ├── macro_global.json # 海外宏观
│   ├── scoring.json    # 综合打分
│   ├── hf_macro.json   # 高频跟踪
│   └── ai_pressure.json # AI压力指数
├── scripts/
│   └── update_all.py   # 数据更新脚本（GitHub Actions 调用）
└── .github/workflows/
    └── update.yml      # 每周六 20:00（北京时间）自动更新
```

## 更新方式

### 自动更新（GitHub Actions）
每周六 20:00（北京时间）自动运行，更新 `data/` 目录下的 JSON 文件。

### 手动更新
1. 在本地运行数据提取脚本生成新的 `data/*.json`
2. 复制到仓库 `data/` 目录
3. `git add data/ && git commit -m "update data" && git push`

## 模块

| Tab | 核心功能 |
|---|---|
| 总览 | 市场速览5卡 + 177对象×18列综合比较表 |
| 估值 | PE/PB十年序列 · 分位 · 远期PE |
| 盈利 | 26H1/26E/27E增速 · 二阶导 · ROE |
| 情绪 | 大盘ERP/广度 · 风格收益差/红利 · 行业热力图 · 机构持仓 |
| 国内宏观 | 月度宏观 + 周度高频（长江数据） |
| 资金面 | 私募仓位 · 两融 · ETF · 新备案 · 量化净值 · 汇金ETF |
| 海外宏观 | 美债分解 · FedWatch · PCE · 油价 + AI压力指数子页 |
| 综合打分 | 五维排名 · PB-ROE · 胜率-赔率象限 · PEG象限 |

## 数据源

- Wind底稿（估值/盈利/公募持仓）— 需本地更新后push
- iFinD EDB（宏观/海外）— 需本地更新后push
- 橘子全A面板（广度/成交占比）— 需本地更新后push
- lxwfof（私募仓位/备案/净值）— 需本地更新后push
- 进门MCP（指数时序/研报）— 需本地更新后push
