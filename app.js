/* 行业比较 DashBoard — 前端逻辑
 * 模块：总览 / 估值 / 盈利 / 情绪（大盘·风格·行业）/ 国内宏观(空) / 海外宏观(空)
 * 交互：数据拉条 / 图表模糊搜索 / 图表说明(localStorage) / 时间范围
 */
(function () {
  'use strict';

  var D = null;  // 由 boot() 在数据就绪后赋值（外挂JSON模式）；内嵌模式立即有值
  var PALETTE = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d',
                 '#475569', '#b45309', '#0d9488', '#9333ea', '#65a30d'];

  var MODULES = [
    { id: 'overview',  name: '总览', icon: '览', dataKey: 'overview' },
    { id: 'weekly',    name: '每周行情', icon: '周', dataKey: 'weekly_market' },
    { id: 'valuation', name: '估值情况', icon: '估', dataKey: 'valuation',
      children: [
        { name: '风格指数', section: '风格指数' },
        { name: 'A股整体', section: 'A股整体' },
        { name: '申万一级行业', section: '申万一级行业' },
        { name: '申万二级行业', section: '申万二级行业' }
      ] },
    { id: 'earnings', name: '盈利情况', icon: '盈', dataKey: 'earnings',
      children: [
        { name: 'A股整体', section: 'A股整体' },
        { name: '风格指数', section: '风格指数' },
        { name: '申万一级行业', section: '申万一级行业' },
        { name: '申万二级行业', section: '申万二级行业' }
      ] },
    { id: 'sentiment', name: '情绪指标', icon: '情', dataKey: 'sentiment',
      children: [
        { name: '大盘情绪', section: '大盘情绪' },
        { name: '风格情绪', section: '风格情绪' },
        { name: '行业情绪', section: '行业情绪' },
        { name: '机构持仓', section: '机构持仓' }
      ] },
    { id: 'macro_cn', name: '国内宏观', icon: '内', dataKey: 'macro_cn',
      children: [
        { name: '月度宏观', section: null },
        { name: '周度高频', section: 'hf' }
      ] },
    { id: 'liquidity', name: '资金面', icon: '资', dataKey: 'liquidity' },
    { id: 'macro_global', name: '海外宏观', icon: '外', dataKey: 'macro_global',
      children: [
        { name: '美债与宏观', section: null },
        { name: 'AI压力指数', section: 'ai' }
      ] },
    { id: 'scoring', name: '综合打分', icon: '评', dataKey: 'scoring' }
  ];

  var RANGES = [
    { key: '1Y', label: '1年', days: 365 },
    { key: '3Y', label: '3年', days: 365 * 3 },
    { key: '5Y', label: '5年', days: 365 * 5 },
    { key: 'ALL', label: '全部', days: null }
  ];

  var currentModule = 'overview';
  var currentSection = null;
  var expandedModules = { valuation: true, earnings: true, sentiment: true };
  var currentRange = 'ALL';
  var charts = [];
  var cardRegistry = [];

  /* ---------------- 基础 ---------------- */
  function noteKey(groupKey) {
    return 'hydb_note_' + currentModule + '::' + groupKey;
  }

  var noteModal = (function () {
    var overlay = document.createElement('div');
    overlay.id = 'note-modal';
    overlay.innerHTML =
      '<div class="note-dialog">' +
        '<div class="note-head"><span id="note-title"></span>' +
          '<span class="note-close" title="关闭">&times;</span></div>' +
        '<textarea id="note-text" placeholder="写下这张图的解读口径、数据来源、注意事项…&#10;支持换行，保存后点击标题旁 i 可再次查看/修改。"></textarea>' +
        '<div class="note-actions">' +
          '<span class="note-hint">说明保存在本浏览器 localStorage。</span>' +
          '<button class="note-btn primary" id="note-save">保存</button>' +
          '<button class="note-btn" id="note-cancel">取消</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    var curKey = null, curBtn = null;
    overlay.querySelector('.note-close').onclick =
    document.getElementById('note-cancel').onclick = function () { overlay.classList.remove('open'); };
    overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) overlay.classList.remove('open'); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') overlay.classList.remove('open'); });
    document.getElementById('note-save').onclick = function () {
      var text = document.getElementById('note-text').value;
      if (text.trim()) localStorage.setItem(curKey, text);
      else localStorage.removeItem(curKey);
      if (curBtn) curBtn.classList.toggle('has-note', !!localStorage.getItem(curKey));
      overlay.classList.remove('open');
    };
    return {
      open: function (groupKey, title, btn) {
        curKey = noteKey(groupKey); curBtn = btn;
        document.getElementById('note-title').textContent = title + ' — 图表说明';
        document.getElementById('note-text').value = localStorage.getItem(curKey) || '';
        overlay.classList.add('open');
        document.getElementById('note-text').focus();
      }
    };
  })();

  function renderNav() {
    var nav = document.getElementById('nav');
    nav.innerHTML = '';
    MODULES.forEach(function (m) {
      var info = (D.meta.manifest || {})[m.id] || {};
      var item = document.createElement('div');
      var isActive = m.id === currentModule && !currentSection;
      item.className = 'nav-item' + (isActive ? ' active' : '');
      var badge = info.status === 'pending' ? '未接入' : (info.count != null ? String(info.count) : '');
      var arrow = m.children ? '<span class="nav-arrow">' + (expandedModules[m.id] ? '▾' : '▸') + '</span>' : '';
      item.innerHTML = '<span class="nav-icon">' + m.icon + '</span>' +
        '<span>' + m.name + '</span>' + arrow +
        (badge ? '<span class="nav-badge">' + badge + '</span>' : '');
      item.onclick = function () {
        if (m.children) expandedModules[m.id] = !expandedModules[m.id];
        switchModule(m.id, null);
      };
      nav.appendChild(item);
      if (m.children && expandedModules[m.id]) {
        m.children.forEach(function (c) {
          var sub = document.createElement('div');
          var subActive = m.id === currentModule && currentSection === c.section;
          sub.className = 'nav-sub-item' + (subActive ? ' active' : '');
          sub.innerHTML = '<span>' + c.name + '</span>';
          sub.onclick = function (e) {
            e.stopPropagation();
            expandedModules[m.id] = true;
            switchModule(m.id, c.section);
          };
          nav.appendChild(sub);
        });
      }
    });
  }

  function renderHealth() {
    var panel = document.getElementById('health-panel');
    var mf = D.meta.manifest || {};
    panel.innerHTML = '';
    MODULES.forEach(function (m) {
      var info = mf[m.id] || {};
      var chip = document.createElement('div');
      chip.className = 'health-chip';
      var cls = 'ok', dateText = info.data_end || '-';
      if (!info.data_end) { cls = 'pending'; dateText = '未接入'; }
      else {
        var lag = (Date.now() - new Date(info.data_end).getTime()) / 86400000;
        if (lag > 10) cls = 'stale';
        dateText = '截至 ' + info.data_end.slice(5);
      }
      chip.innerHTML = '<span class="health-dot ' + cls + '"></span>' +
        '<span>' + m.name + '</span><span class="h-date">' + dateText + '</span>';
      panel.appendChild(chip);
    });
  }

  /* ---------------- 图表公共 ---------------- */
  function baseLineOption(unit) {
    return {
      color: PALETTE,
      grid: { left: 52, right: 20, top: 42, bottom: 52 },
      legend: { top: 4, type: 'scroll', icon: 'roundRect',
                itemWidth: 14, itemHeight: 3, textStyle: { fontSize: 12, color: '#4b5563' } },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross', label: { backgroundColor: '#374151' } },
        backgroundColor: 'rgba(255,255,255,.96)', borderColor: '#e5e8ef',
        textStyle: { color: '#1f2430', fontSize: 12 },
        valueFormatter: function (v) { return v == null ? '-' : (typeof v === 'number' ? v.toFixed(2) : v) + (unit ? ' ' + unit : ''); }
      },
      xAxis: {
        type: 'time',
        axisLine: { lineStyle: { color: '#d5dae3' } },
        axisLabel: { color: '#6b7280', fontSize: 11 },
        splitLine: { show: false }
      },
      yAxis: {
        type: 'value', scale: true,
        axisLabel: { color: '#6b7280', fontSize: 11 },
        splitLine: { lineStyle: { color: '#eef1f6' } }
      },
      dataZoom: [
        { type: 'inside' },
        { type: 'slider', show: false, height: 18, bottom: 8, borderColor: 'transparent',
          backgroundColor: 'rgba(241,243,248,0.45)', fillerColor: 'rgba(148,163,184,0.16)',
          handleStyle: { color: '#cbd5e1' }, moveHandleStyle: { color: '#cbd5e1' },
          emphasis: { moveHandleStyle: { color: '#94a3b8' } },
          dataBackground: { lineStyle: { color: 'rgba(203,213,225,0.55)' }, areaStyle: { color: 'rgba(226,232,240,0.28)' } },
          selectedDataBackground: { lineStyle: { color: 'rgba(148,163,184,0.7)' }, areaStyle: { color: 'rgba(203,213,225,0.22)' } },
          textStyle: { color: '#cbd5e1', fontSize: 10 },
          labelFormatter: function (v) { return echarts.format.formatTime('yyyy-MM', v); } }
      ]
    };
  }

  function pairDates(dates, values) {
    var out = [];
    for (var i = 0; i < dates.length; i++) {
      if (values[i] != null) out.push([dates[i], values[i]]);
    }
    return out;
  }

  function applyRange() {
    var r = null;
    for (var i = 0; i < RANGES.length; i++) if (RANGES[i].key === currentRange) r = RANGES[i];
    charts.forEach(function (c) {
      // 只对本来就有 dataZoom 的时序图设置范围；
      // 对类目图/散点图等（无 dataZoom）注入 setOption 会让 ECharts 自动创建默认
      // dataZoom 组件 → 卡片底部冒出多余蓝色拉条。首次调用时判定并缓存，避免被注入后误判。
      if (c.__noZoom === undefined) {
        var o = null;
        try { o = c.getOption() || {}; } catch (e) { o = null; }
        c.__noZoom = !(o && o.dataZoom && o.dataZoom.length);
      }
      if (c.__noZoom) return;
      if (r && r.days) {
        var startVal = +new Date(Date.now() - r.days * 86400000);
        c.setOption({ dataZoom: [{ startValue: startVal }, { startValue: startVal, endValue: null }] });
      } else {
        c.setOption({ dataZoom: [{ start: 0, end: 100 }, { start: 0, end: 100 }] });
      }
    });
  }

  function makeCard(title, unit, dateEnd, wide, note, groupKey) {
    var card = document.createElement('div');
    card.className = 'card' + (wide ? ' wide' : '');
    card.dataset.chartKey = groupKey || title;
    var infoBtn = '';
    if (groupKey) {
      var hasNote = !!localStorage.getItem(noteKey(groupKey));
      infoBtn = '<span class="info-btn' + (hasNote ? ' has-note' : '') + '" title="图表说明">i</span>';
    }
    card.innerHTML =
      '<div class="card-header">' +
        '<span class="card-title">' + title + '</span>' + infoBtn +
        (unit ? '<span class="card-unit">(' + unit + ')</span>' : '') +
        '<span class="card-date">数据截至 ' + (dateEnd || '-') + '</span>' +
      '</div>' +
      '<div class="card-body"></div>' +
      (note ? '<div class="card-note">' + note + '</div>' : '');
    if (groupKey) {
      card.querySelector('.info-btn').onclick = function (e) {
        e.stopPropagation();
        noteModal.open(groupKey, title, this);
      };
    }
    return card;
  }

  function registerCard(card, chart, searchableText) {
    cardRegistry.push({ el: card, chart: chart, text: (searchableText || '').toLowerCase() });
  }

  function addZoomHover(card, chart) {
    // 仅对真正配置了 dataZoom 的长时间序列图启用；
    // 否则（类目条形图/散点图/热力图等）会被注入 ECharts 默认 dataZoom，冒出多余蓝色拉条
    var opt = null;
    try { opt = chart.getOption() || {}; } catch (e) { opt = null; }
    if (!opt || !opt.dataZoom || !opt.dataZoom.length) return;
    var strip = document.createElement('div');
    strip.className = 'zoom-hover-strip';
    card.querySelector('.card-body').appendChild(strip);
    var hideT = null;
    function showSlider() {
      clearTimeout(hideT);
      strip.style.pointerEvents = 'none';
      chart.setOption({ dataZoom: [{}, { show: true }] });
    }
    function hideSlider() {
      hideT = setTimeout(function () {
        chart.setOption({ dataZoom: [{}, { show: false }] });
        strip.style.pointerEvents = '';
      }, 250);
    }
    strip.addEventListener('mouseenter', showSlider);
    chart.on('globalout', hideSlider);
  }

  function renderToolbar(container, catFilter, catChange) {
    var bar = document.createElement('div');
    bar.className = 'toolbar';
    var label = document.createElement('span');
    label.className = 'toolbar-label';
    label.textContent = '时间范围';
    bar.appendChild(label);
    RANGES.forEach(function (r) {
      var btn = document.createElement('span');
      btn.className = 'range-btn' + (r.key === currentRange ? ' active' : '');
      btn.textContent = r.label;
      btn.onclick = function () {
        currentRange = r.key;
        bar.querySelectorAll('.range-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        applyRange();
      };
      bar.appendChild(btn);
    });
    if (catFilter) {
      var sep = document.createElement('span');
      sep.className = 'toolbar-label';
      sep.style.marginLeft = '10px';
      sep.textContent = '对象';
      bar.appendChild(sep);
      catFilter.forEach(function (c) {
        var btn = document.createElement('span');
        btn.className = 'cat-btn' + (c.active ? ' active' : '');
        btn.textContent = c.label;
        btn.onclick = function () {
          bar.querySelectorAll('.cat-btn').forEach(function (b) { b.classList.remove('active'); });
          btn.classList.add('active');
          catChange(c.key);
        };
        bar.appendChild(btn);
      });
    }
    var searchWrap = document.createElement('span');
    searchWrap.className = 'chart-search';
    searchWrap.innerHTML =
      '<input type="text" id="chart-search-input" placeholder="🔍 模糊搜索图表，如 ERP / 电子 / 分位">' +
      '<span id="chart-search-count"></span>';
    bar.appendChild(searchWrap);
    var input = searchWrap.querySelector('#chart-search-input');
    var count = searchWrap.querySelector('#chart-search-count');
    var t = null;
    input.oninput = function () {
      clearTimeout(t);
      t = setTimeout(function () {
        var q = input.value.trim().toLowerCase();
        var shown = 0;
        cardRegistry.forEach(function (c) {
          var hit = !q || c.text.indexOf(q) !== -1;
          c.el.style.display = hit ? '' : 'none';
          if (hit) { shown++; if (c.chart) c.chart.resize(); }
        });
        count.textContent = q ? (shown + ' / ' + cardRegistry.length + ' 张') : '';
      }, 120);
    };
    container.appendChild(bar);
  }

  function num2(v) { return (v == null || isNaN(v)) ? '—' : Number(v).toFixed(2); }
  function num1(v) { return (v == null || isNaN(v)) ? '—' : Number(v).toFixed(1); }

  function percentileColor(v) {
    if (v <= 20) return '#16a34a';
    if (v <= 50) return '#2563eb';
    if (v <= 80) return '#d97706';
    return '#dc2626';
  }

  function clearCanvas() {
    charts.forEach(function (c) { try { c.dispose(); } catch (e) {} });
    charts = [];
    cardRegistry = [];
  }

  /* ---------------- 总览 ---------------- */
  var OV_CAT = [['all', '全部'], ['A股', 'A股'], ['风格', '风格'], ['一级行业', '申万一级'], ['二级行业', '申万二级']];

  var FUND_MAP = null;
  function fundOverOf(name) {
    if (!FUND_MAP) {
      FUND_MAP = {};
      var F = D.sentiment.fund;
      var li = F.dates.length - 1;
      F.l1.forEach(function (s) { if (s.over[li] != null) FUND_MAP[s.name] = s.over[li] * 100; });
      F.l2.forEach(function (s) { if (s.over[li] != null) FUND_MAP[s.name] = s.over[li] * 100; });
    }
    return FUND_MAP[name];
  }

  function buildOverviewRow(name, cat) {
    var peS = null, pbS = null, roeS = null, er = null;
    D.valuation.pe.series.forEach(function (s) { if (s.name === name && s.cat === cat) peS = s; });
    D.valuation.pb.series.forEach(function (s) { if (s.name === name && s.cat === cat) pbS = s; });
    D.valuation.roe.series.forEach(function (s) { if (s.name === name && s.cat === cat) roeS = s; });
    D.earnings.rows.forEach(function (r) { if (r.name === name && r.cat === cat) er = r; });
    return {
      name: name, cat: cat,
      pe: peS ? peS.latest : null, pePct: peS && peS.pct != null ? peS.pct * 100 : null,
      pb: pbS ? pbS.latest : null, pbPct: pbS && pbS.pct != null ? pbS.pct * 100 : null,
      roe: roeS && roeS.latest != null ? roeS.latest * 100 : null,
      roePct: roeS && roeS.pct != null ? roeS.pct * 100 : null,
      g26h1: er && er.g26h1 != null ? er.g26h1 * 100 : null,
      g26ePrev: er && er.g26e_prev != null ? er.g26e_prev * 100 : null,
      g26e: er && er.g26e != null ? er.g26e * 100 : null,
      g26eChg: (er && er.g26e != null && er.g26e_prev != null) ? (er.g26e - er.g26e_prev) * 100 : null,
      g27e: er && er.g27e != null ? er.g27e * 100 : null,
      accel: er && er.accel != null ? er.accel * 100 : null,
      fundOv: (cat === '一级行业' || cat === '二级行业') ? fundOverOf(name) : null
    };
  }

  function renderOverview(container) {
    // ---- 市场速览（5个关键读数） ----
    var speedBar = document.createElement('div');
    speedBar.className = 'snap-grid';
    speedBar.style.marginBottom = '16px';
    var l1rows = D.earnings.rows.filter(function (r) { return r.cat === '一级行业'; });
    var hiGrowth = l1rows.filter(function (r) { return r.g26e != null && r.g26e > 0.20; }).length;
    var accelPos = l1rows.filter(function (r) { return r.g26e != null && r.g27e != null && (r.g27e - r.g26e) > 0; }).length;
    var cheapPE = D.valuation.pe.series.filter(function (s) { return s.cat === '一级行业' && s.pct != null && s.pct < 0.30; }).length;
    var hotSent = D.sentiment.industry.industries.filter(function (s) {
      var v = s.sent[s.sent.length - 1];
      return v != null && v >= 80;
    }).length;
    var scoreHi = D.scoring ? D.scoring.rows.filter(function (r) { return r.composite >= 65; }).length : 0;
    var speedData = [
      { label: '高景气广度', val: hiGrowth + '/31', sub: '26E增速>20%的行业数', color: hiGrowth >= 15 ? 'var(--red)' : 'var(--text-main)' },
      { label: '加速广度', val: accelPos + '/31', sub: '二阶导>0的行业数', color: accelPos >= 15 ? 'var(--red)' : 'var(--text-main)' },
      { label: '低估值广度', val: cheapPE + '/31', sub: 'PE十年分位<30%的行业数', color: cheapPE >= 10 ? 'var(--green)' : 'var(--text-main)' },
      { label: '过热广度', val: hotSent + '/30', sub: '情绪>80的行业数(中信)', color: hotSent >= 10 ? 'var(--red)' : 'var(--text-main)' },
      { label: '推荐广度', val: scoreHi + '/31', sub: '综合打分>65的行业数', color: scoreHi >= 10 ? 'var(--red)' : 'var(--text-main)' },
    ];
    speedData.forEach(function (d) {
      var el = document.createElement('div');
      el.className = 'snap-card';
      el.style.padding = '10px 14px';
      el.innerHTML = '<div style="font-size:11px;color:var(--text-faint);">' + d.label + '</div>' +
        '<div style="font-size:22px;font-weight:700;color:' + d.color + ';margin:2px 0;">' + d.val + '</div>' +
        '<div style="font-size:10px;color:var(--text-faint);">' + d.sub + '</div>';
      speedBar.appendChild(el);
    });
    container.appendChild(speedBar);

    // ---- 各分页阅读指南 ----
    var guideCard = makeCard('各分页阅读指南（怎么用这个Dashboard）', '', '', true, null, '阅读指南');
    var gBody = guideCard.querySelector('.card-body');
    gBody.style.height = 'auto';
    gBody.style.padding = '6px 16px 14px';
    gBody.style.fontSize = '12px';
    gBody.style.lineHeight = '1.8';
    gBody.style.color = 'var(--text-sub)';
    gBody.innerHTML =
      '<b style="color:var(--text-main);">第一层（总览）</b>：本页——市场速览5个数字 + 全部177个对象×12列综合比较表，30秒判断"市场处于什么状态、哪些行业值得看"。<br>'
      + '<b style="color:var(--text-main);">第二层（行业比较）</b>：<b>盈利</b>看26E/27E增速、二阶导与ROE → <b>估值</b>看PE/PB十年分位与远期PE → <b>情绪</b>看行业情绪热力图与ERP。'
      + '判断顺序：先看盈利分位（胜率），再看估值分位（赔率），最后看情绪确认拥挤度。<br>'
      + '<b style="color:var(--text-main);">第三层（宏观与资金）</b>：<b>国内宏观</b>看六角度（金融领先→增长→K型消费→物价） → <b>资金面</b>看私募仓位、两融、ETF流向。'
      + '宏观定基调（牛市/熊市/震荡），资金定拐点（增量/存量/去化）。<br>'
      + '<b style="color:var(--text-main);">第四层（海外）</b>：<b>海外宏观</b>看美债分解（短端加息预期+长端期限溢价）、CDS风险、油价催化。<br>'
      + '<b style="color:var(--text-main);">第五层（结论）</b>：<b>综合打分</b>——五维排名合成 + PB-ROE散点 + 胜率-赔率象限 + PEG排序。输出行业配置建议。';
    container.appendChild(guideCard);
    registerCard(guideCard, null, '阅读指南 使用方法 导航');

    // 快照卡
    var snap = document.createElement('div');
    snap.className = 'snap-grid';
    D.valuation.index_snapshot.forEach(function (s) {
      var el = document.createElement('div');
      el.className = 'snap-card';
      var rows = '';
      if (s.pe != null) rows += '<div class="snap-row"><span>PE-TTM</span><span class="snap-val">' + num2(s.pe) +
        (s.pe_pct_10y != null ? ' <span style="font-weight:400;color:#9ca3af;">(10Y分位 ' + s.pe_pct_10y.toFixed(0) + '%)</span>' : '') + '</span></div>';
      if (s.pb != null) rows += '<div class="snap-row"><span>PB-LF</span><span class="snap-val">' + num2(s.pb) +
        (s.pb_pct_10y != null ? ' <span style="font-weight:400;color:#9ca3af;">(10Y分位 ' + s.pb_pct_10y.toFixed(0) + '%)</span>' : '') + '</span></div>';
      if (s.dy != null) rows += '<div class="snap-row"><span>股息率</span><span class="snap-val">' + num2(s.dy) + '%</span></div>';
      if (s.close != null) rows += '<div class="snap-row"><span>收盘</span><span class="snap-val">' + num2(s.close) + '</span></div>';
      el.innerHTML = '<div><span class="snap-name">' + s.name + '</span><span class="snap-code">' + s.code + '</span></div>' +
        '<div class="snap-rows">' + rows + '</div>' +
        '<div class="snap-date">截至 ' + s.date + ' · </div>';
      snap.appendChild(el);
    });
    container.appendChild(snap);

    // 综合表
    var seen = {}, names = [];
    D.earnings.rows.forEach(function (r) {
      var key = r.cat + '::' + r.name;
      if (!seen[key]) { seen[key] = true; names.push([r.name, r.cat]); }
    });

    var state = { cat: 'all', sortKey: null, sortDir: -1 };

    function draw() {
      var old = document.querySelector('.ov-table-wrap');
      if (old) old.remove();
      var rows = [];
      names.forEach(function (nc) {
        if (state.cat !== 'all' && nc[1] !== state.cat) return;
        rows.push(buildOverviewRow(nc[0], nc[1]));
      });
      if (state.sortKey) {
        rows.sort(function (a, b) {
          var va = a[state.sortKey], vb = b[state.sortKey];
          if (va == null && vb == null) return 0;
          if (va == null) return 1;
          if (vb == null) return -1;
          return (va - vb) * state.sortDir;
        });
      }
      var wrap = document.createElement('div');
      wrap.className = 'ov-table-wrap';
      var cols = [
        ['name', '名称'], ['cat', '类别'],
        ['pe', 'PE-TTM'], ['pePct', 'PE分位%'],
        ['pb', 'PB-LF'], ['pbPct', 'PB分位%'],
        ['roe', 'ROE-TTM%'], ['roePct', 'ROE分位%'],
        ['g26h1', '26H1增速%'], ['g26ePrev', '26E上周%'], ['g26e', '26E本周%'], ['g26eChg', '修正pp'], ['g27e', '27E增速%'],
        ['accel', '二阶导(27E-26E)pp'],
        ['fundOv', '公募超配pp(26Q2)']
      ];
      var html = '<table id="ov-table"><thead><tr>';
      cols.forEach(function (c) {
        html += '<th data-k="' + c[0] + '">' + c[1] + (state.sortKey === c[0] ? (state.sortDir < 0 ? ' ▾' : ' ▴') : '') + '</th>';
      });
      html += '</tr></thead><tbody>';
      rows.forEach(function (r) {
        html += '<tr><td>' + r.name + '</td><td class="cat-tag">' + r.cat + '</td>';
        cols.slice(2).forEach(function (c) {
          var v = r[c[0]];
          if (v == null) { html += '<td style="color:#c3c9d4;">-</td>'; return; }
          var cls = '';
          if (['g26h1', 'g26ePrev', 'g26e', 'g26eChg', 'g27e', 'accel', 'roe', 'fundOv'].indexOf(c[0]) >= 0) cls = v >= 0 ? 'pos' : 'neg';
          if (['pePct', 'pbPct', 'roePct'].indexOf(c[0]) >= 0) cls = v > 80 ? 'pos' : (v < 20 ? 'neg' : '');
          var txt = Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2);
          html += '<td class="' + cls + '">' + txt + '</td>';
        });
        html += '</tr>';
      });
      html += '</tbody></table>';
      wrap.innerHTML = html;
      container.appendChild(wrap);
      wrap.querySelectorAll('th').forEach(function (th) {
        th.onclick = function () {
          var k = th.getAttribute('data-k');
          if (k === 'name' || k === 'cat') return;
          if (state.sortKey === k) state.sortDir = -state.sortDir;
          else { state.sortKey = k; state.sortDir = -1; }
          draw();
        };
      });
    }

    renderToolbar(container,
      OV_CAT.map(function (c) { return { key: c[0], label: c[1], active: c[0] === 'all' }; }),
      function (k) { state.cat = k; draw(); });
    draw();

    var note = document.createElement('div');
    note.className = 'card-note';
    note.style.marginTop = '10px';
    note.innerHTML = '说明：估值为月度序列（PE/PB截至2026-09，ROE截至2026Q2），盈利为个股一致预期汇总（26H1=2026上半年实际，26E/27E=分析师一致预期，含上周/本周两期对比，截至2026-09-20），公募超配=主动偏股基金重仓行业配置−全市场流通权重（2026Q2，仅行业口径）。'
      + '分位为近十年月度分位。二阶导=27E增速−26E增速，>0 表示盈利预期仍在加速。点击表头排序。';
    container.appendChild(note);
  }

  /* ---------------- 每周行情（周报四图） ---------------- */
  function renderWeekly(container) {
    var WK = D.weekly_market;
    if (!WK || !WK.charts || !WK.charts.length) {
      container.innerHTML = '<div style="padding:40px;text-align:center;color:#6b7280;">每周行情数据未加载</div>';
      return;
    }
    var grid = document.createElement('div');
    grid.className = 'grid';
    container.appendChild(grid);

    var POS = '#2c4a7c', NEG = '#e8834a';   // 正=深蓝、负=橙红（对齐周报原图）

    WK.charts.forEach(function (c) {
      var rows = c.rows.slice();
      var names = rows.map(function (r) { return r.name; }).reverse();
      var vals = rows.map(function (r) { return r.v; }).reverse();
      var posN = rows.filter(function (r) { return r.v >= 0; }).length;
      var title = c.title.replace(/（周，%）/, '');
      var card = makeCard(title + '（周涨跌幅）', '%', WK.asof, true,
        '区间 ' + (c.period || WK.asof) + '：共 ' + rows.length + ' 项，上涨 ' + posN
        + ' 项、下跌 ' + (rows.length - posN) + ' 项。'
        + '领涨 ' + rows[0].name + ' ' + rows[0].v.toFixed(2) + '%，'
        + '领跌 ' + rows[rows.length - 1].name + ' ' + rows[rows.length - 1].v.toFixed(2) + '%。'
        + '（深色=上涨，橙色=下跌）', 'WK_' + c.id);
      grid.appendChild(card);
      var body = card.querySelector('.card-body');
      body.style.height = Math.max(300, rows.length * 21 + 50) + 'px';
      var chart = echarts.init(body);
      chart.setOption({
        grid: { left: 136, right: 74, top: 14, bottom: 26 },
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' },
          backgroundColor: 'rgba(255,255,255,.96)', borderColor: '#e5e8ef',
          textStyle: { color: '#1f2430', fontSize: 12 },
          formatter: function (ps) {
            var i = names.length - 1 - ps[0].dataIndex;
            return rows[i].name + '：' + (rows[i].v >= 0 ? '+' : '') + rows[i].v.toFixed(2) + '%';
          } },
        xAxis: { type: 'value', axisLabel: { color: '#6b7280', fontSize: 10, formatter: '{value}%' },
          axisLine: { show: false }, axisTick: { show: false },
          splitLine: { lineStyle: { color: '#eef1f6' } } },
        yAxis: { type: 'category', data: names, axisTick: { show: false },
          axisLabel: { color: '#374151', fontSize: 11 },
          axisLine: { lineStyle: { color: '#d5dae3' } } },
        series: [{
          type: 'bar', barMaxWidth: 13,
          data: vals.map(function (v) {
            return { value: v, itemStyle: { color: v >= 0 ? POS : NEG, borderRadius: [0, 2, 2, 0] } };
          }),
          label: { show: true, fontSize: 10.5, color: '#4b5563',
            formatter: function (p) { return p.value.toFixed(1); } },
          labelLayout: function (params) {
            return { x: params.rect.x + (params.rect.width >= 0 ? params.rect.width + 4 : -4),
                     align: params.rect.width >= 0 ? 'left' : 'right' };
          },
          markLine: { silent: true, symbol: 'none', lineStyle: { color: '#9ca3af', width: 1 },
            data: [{ xAxis: 0, label: { show: false } }] }
        }]
      });
      charts.push(chart);
      addZoomHover(card, chart);
      registerCard(card, chart, title + ' 周涨跌幅 ' + rows.map(function (r) { return r.name; }).join(' '));
    });
  }

  /* ---------------- 估值 ---------------- */
  function monthDates(dates) {
    return dates.map(function (d) { return d + '-15'; });
  }

  function groupLine(container, title, unit, dates, arr, wide, note, groupKey) {
    var dateEnd = dates.length ? dates[dates.length - 1] : '';
    var card = makeCard(title, unit, dateEnd, wide, note, groupKey);
    container.appendChild(card);
    var chart = echarts.init(card.querySelector('.card-body'));
    var opt = baseLineOption(unit);
    opt.series = arr.map(function (s) {
      return { name: s.name, type: 'line', showSymbol: false,
        lineStyle: { width: 1.6 }, emphasis: { focus: 'series' },
        data: pairDates(dates, s.values) };
    });
    chart.setOption(opt);
    charts.push(chart);
    addZoomHover(card, chart);
    registerCard(card, chart, groupKey + ' ' + arr.map(function (s) { return s.name; }).join(' '));
    return chart;
  }

  function percentileBar(container, metric, cat, title) {
    var src = D.valuation[metric].series.filter(function (s) { return s.cat === cat; });
    var rows = src.filter(function (s) { return s.pct != null; })
                  .map(function (s) { return { name: s.name, value: parseFloat((s.pct * 100).toFixed(1)) }; })
                  .sort(function (a, b) { return a.value - b.value; });
    if (!rows.length) return;
    var card = makeCard(title, '%', D.valuation[metric].dates[D.valuation[metric].dates.length - 1], false,
      '当前值在近十年月度序列中的分位。绿=便宜(≤20%)，蓝=中性，橙=偏贵，红=高估(>80%)。', title);
    container.appendChild(card);
    var pbody = card.querySelector('.card-body');
    // 类目多（如二级行业131个）时卡片高度自适应，避免条形挤在一起
    if (rows.length > 40) pbody.style.height = (rows.length * 17 + 56) + 'px';
    var chart = echarts.init(pbody);
    chart.setOption({
      grid: { left: 80, right: 46, top: 16, bottom: 26 },
      tooltip: { trigger: 'item', formatter: function (p) { return p.name + '：' + p.value + '% 分位'; } },
      xAxis: { type: 'value', max: 100,
        axisLabel: { color: '#6b7280', fontSize: 11, formatter: '{value}%' },
        splitLine: { lineStyle: { color: '#eef1f6' } } },
      yAxis: { type: 'category', data: rows.map(function (r) { return r.name; }),
        axisLine: { lineStyle: { color: '#d5dae3' } },
        axisLabel: { color: '#374151', fontSize: 11 } },
      series: [{ type: 'bar', barWidth: 13,
        data: rows.map(function (r) {
          return { value: r.value, itemStyle: { color: percentileColor(r.value), borderRadius: [0, 6, 6, 0] } };
        }),
        label: { show: true, position: 'right', fontSize: 10, color: '#6b7280',
                 formatter: function (p) { return Math.round(p.value); } },
        markLine: { silent: true, symbol: 'none', lineStyle: { color: '#c3c9d4', type: 'dashed', width: 1 },
          data: [{ xAxis: 50 }], label: { show: true, position: 'end', formatter: '50%', fontSize: 10, color: '#9ca3af' } }
      }]
    });
    charts.push(chart);
    registerCard(card, chart, title + ' ' + rows.map(function (r) { return r.name; }).join(' '));
  }

  function industryPicker(container, metric, cat, title, unit) {
    var src = D.valuation[metric].series.filter(function (s) { return s.cat === cat; });
    if (!src.length) return;
    var dates = monthDates(D.valuation[metric].dates);
    var dateEnd = D.valuation[metric].dates[D.valuation[metric].dates.length - 1];
    var card = makeCard(title, unit, dateEnd, true,
      '下拉切换行业。时间序列为月度（2015-01 起，截至 ' + dateEnd + '）。', title);
    var head = card.querySelector('.card-header');
    var sel = document.createElement('select');
    sel.className = 'roll-select';
    src.forEach(function (s) {
      var op = document.createElement('option');
      op.value = s.name; op.textContent = s.name;
      sel.appendChild(op);
    });
    head.insertBefore(sel, card.querySelector('.card-date'));
    container.appendChild(card);
    var chart = echarts.init(card.querySelector('.card-body'));
    var opt = baseLineOption(unit);
    chart.setOption(opt);
    function load(name) {
      var s = src.filter(function (x) { return x.name === name; })[0];
      chart.setOption({ series: [{ name: name, type: 'line', showSymbol: false,
        lineStyle: { width: 1.8, color: '#2563eb' }, itemStyle: { color: '#2563eb' },
        emphasis: { focus: 'series' }, data: s ? pairDates(dates, s.values) : [] }] });
    }
    sel.onchange = function () { load(sel.value); };
    load(src[0].name);
    charts.push(chart);
    addZoomHover(card, chart);
    registerCard(card, chart, title + ' ' + src.map(function (s) { return s.name; }).join(' '));
  }

  function forwardPE(container, cat) {
    var rows = [];
    D.earnings.rows.forEach(function (r) {
      if (r.cat !== cat) return;
      var peS = null;
      D.valuation.pe.series.forEach(function (s) { if (s.name === r.name && s.cat === r.cat) peS = s; });
      if (!peS || peS.latest == null || !peS.latest) return;
      var pe = peS.latest;
      var pe26 = (r.g26e != null && r.g26e > -1) ? pe / (1 + r.g26e) : null;
      var pe27 = (r.g27e != null && r.g27e > -1 && r.g26e != null && r.g26e > -1)
        ? (pe / (1 + r.g26e)) / (1 + r.g27e) : null;
      if (pe26 == null) return;
      rows.push({ name: r.name, pe: pe, pe26: pe26, pe27: pe27 });
    });
    if (!rows.length) return;
    rows.sort(function (a, b) { return b.pe - a.pe; });
    var cap = 46;
    if (rows.length > cap) rows = rows.slice(0, cap).concat(rows.slice(-6));
    var CAT_NAME = { '风格': '风格指数', 'A股': 'A股整体', '一级行业': '申万一级行业', '二级行业': '申万二级行业' };
    var card = makeCard('远期PE · ' + (CAT_NAME[cat] || cat) + '（价格不变假设）', '倍', '2026-09-20', true,
      'PE-26E = 当前PE-TTM ÷ (1+26E盈利增速)；PE-27E 再除以 (1+27E增速)。'
      + '假设价格不变、盈利兑现一致预期，估值被动消化到什么水平。仅作静态推演，不构成盈利/目标价预测。'
      + '按 PE-TTM 降序排列（折线）。', '远期PE' + cat);
    container.appendChild(card);
    var fb = card.querySelector('.card-body');
    if (rows.length > 40) fb.style.height = Math.max(320, Math.round(rows.length * 5.5) + 90) + 'px';
    var chart = echarts.init(fb);
    chart.setOption({
      color: ['#94a3b8', '#2563eb', '#dc2626'],
      grid: { left: 60, right: 20, top: 42, bottom: 62 },
      legend: { top: 4, data: ['PE-TTM', 'PE-26E', 'PE-27E'], icon: 'roundRect', itemWidth: 14, itemHeight: 3,
                textStyle: { fontSize: 12, color: '#4b5563' } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'line' },
        backgroundColor: 'rgba(255,255,255,.96)', borderColor: '#e5e8ef',
        textStyle: { color: '#1f2430', fontSize: 12 } },
      xAxis: { type: 'category', data: rows.map(function (r) { return r.name; }),
        axisLabel: { color: '#6b7280', fontSize: 9, rotate: 60, interval: 'auto' },
        axisLine: { lineStyle: { color: '#d5dae3' } } },
      yAxis: { type: 'value', scale: true, axisLabel: { color: '#6b7280', fontSize: 11 },
        splitLine: { lineStyle: { color: '#eef1f6' } } },
      series: [
        { name: 'PE-TTM', type: 'line', showSymbol: false, connectNulls: true, lineStyle: { width: 1.6 },
          data: rows.map(function (r) { return +r.pe.toFixed(2); }) },
        { name: 'PE-26E', type: 'line', showSymbol: false, connectNulls: true, lineStyle: { width: 1.9 },
          data: rows.map(function (r) { return r.pe26 == null ? null : +r.pe26.toFixed(2); }) },
        { name: 'PE-27E', type: 'line', showSymbol: false, connectNulls: true, lineStyle: { width: 1.6 },
          data: rows.map(function (r) { return r.pe27 == null ? null : +r.pe27.toFixed(2); }) }
      ]
    });
    charts.push(chart);
    registerCard(card, chart, '远期PE ' + rows.map(function (r) { return r.name; }).join(' '));
  }

  function renderValuation(container, section) {
    var grid = document.createElement('div');
    grid.className = 'grid';
    container.appendChild(grid);
    var pe = D.valuation.pe, pb = D.valuation.pb, roe = D.valuation.roe;
    var peDates = monthDates(pe.dates), pbDates = monthDates(pb.dates);

    if (!section || section === '风格指数') {
      var h = document.createElement('div'); h.className = 'section-title'; h.textContent = '风格指数';
      grid.appendChild(h);
      groupLine(grid, 'PE-TTM · 风格指数', '倍', peDates,
        pe.series.filter(function (s) { return s.cat === '风格' && s.name !== '地产'; }), false,
        '月度序列（地产因PE失真已剔除）。大盘/中盘/小盘、价值/成长/红利、周期/金融/消费/医药/TMT/制造。', 'PE风格');
      groupLine(grid, 'PB-LF · 风格指数', '倍', pbDates,
        pb.series.filter(function (s) { return s.cat === '风格'; }), false, null, 'PB风格');
      percentileBar(grid, 'pe', '风格', 'PE-TTM 近10年分位 · 风格');
      percentileBar(grid, 'pb', '风格', 'PB-LF 近10年分位 · 风格');
      forwardPE(grid, '风格');
    }
    if (!section || section === 'A股整体') {
      var h2 = document.createElement('div'); h2.className = 'section-title'; h2.textContent = 'A股整体';
      grid.appendChild(h2);
      groupLine(grid, 'PE-TTM · A股整体', '倍', peDates,
        pe.series.filter(function (s) { return s.cat === 'A股'; }), false, null, 'PE A股');
      groupLine(grid, 'PB-LF · A股整体', '倍', pbDates,
        pb.series.filter(function (s) { return s.cat === 'A股'; }), false, null, 'PB A股');
      groupLine(grid, 'ROE-TTM · A股整体（季度）', '%',
        roe.dates.map(function (d) { return d.slice(0, 10); }),
        roe.series.filter(function (s) { return s.cat === 'A股'; }).map(function (s) {
          return { name: s.name, values: s.values.map(function (v) { return v != null ? v * 100 : null; }) };
        }), false, null, 'ROE A股');
      forwardPE(grid, 'A股');
    }
    if (!section || section === '申万一级行业') {
      var h3 = document.createElement('div'); h3.className = 'section-title'; h3.textContent = '申万一级行业（31个）';
      grid.appendChild(h3);
      industryPicker(grid, 'pe', '一级行业', '单行业 PE-TTM 走势', '倍');
      industryPicker(grid, 'pb', '一级行业', '单行业 PB-LF 走势', '倍');
      percentileBar(grid, 'pe', '一级行业', 'PE-TTM 近10年分位 · 一级行业');
      percentileBar(grid, 'pb', '一级行业', 'PB-LF 近10年分位 · 一级行业');
      forwardPE(grid, '一级行业');
    }
    if (!section || section === '申万二级行业') {
      var h4 = document.createElement('div'); h4.className = 'section-title'; h4.textContent = '申万二级行业（131个）';
      grid.appendChild(h4);
      industryPicker(grid, 'pe', '二级行业', '单二级行业 PE-TTM 走势', '倍');
      industryPicker(grid, 'pb', '二级行业', '单二级行业 PB-LF 走势', '倍');
      percentileBar(grid, 'pe', '二级行业', 'PE-TTM 近10年分位 · 二级行业');
      percentileBar(grid, 'pb', '二级行业', 'PB-LF 近10年分位 · 二级行业');
      forwardPE(grid, '二级行业');
    }
  }

  /* ---------------- 盈利 ---------------- */
  function fmtPct(v) {
    if (v == null) return '-';
    return (v * 100).toFixed(1);
  }

  /* ---------------- 盈利（时间序列视图） ---------------- */
  var EARN_PAGES = [
    { sec: 'A股整体', cat: 'A股', label: 'A股整体' },
    { sec: '风格指数', cat: '风格', label: '风格指数' },
    { sec: '申万一级行业', cat: '一级行业', label: '申万一级行业' },
    { sec: '申万二级行业', cat: '二级行业', label: '申万二级行业' }
  ];

  function earnTS() {
    return D.earnings_ts || { profit: { series: [] }, roe: { series: [] }, cmp: { rows: [] } };
  }

  function earnSeriesOf(cat, kind) {
    var arr = (earnTS()[kind] && earnTS()[kind].series) || [];
    return arr.filter(function (s) { return s.cat === cat; });
  }

  function earnCmpOf(cat, name) {
    var rows = (earnTS().cmp && earnTS().cmp.rows) || [];
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].cat === cat && rows[i].name === name) return rows[i];
    }
    return null;
  }

  function earnSortByG(cat, list) {
    return list.slice().sort(function (a, b) {
      var ca = earnCmpOf(cat, a.name), cb = earnCmpOf(cat, b.name);
      var av = (ca && ca.g26e != null) ? ca.g26e : -1e9;
      var bv = (cb && cb.g26e != null) ? cb.g26e : -1e9;
      return bv - av;
    });
  }

  // 全览：多线时间序列（对象多时取代表样本，避免面条图）
  function earnOverview(grid, cat, label, kind, title, unit, note) {
    var all = earnSeriesOf(cat, kind);
    if (!all.length) return;
    var shown = all, trimmed = false;
    if (all.length > 16) {
      var srt = earnSortByG(cat, all);
      var head = srt.slice(0, 8), tail = srt.slice(-4), seen = {};
      shown = head.concat(tail).filter(function (s) {
        if (seen[s.name]) return false;
        seen[s.name] = 1; return true;
      });
      trimmed = true;
    }
    var card = makeCard(title + ' · ' + label, unit, '2026-09-20', true,
      note + (trimmed ? '（对象较多，此处展示 26E 增速最高 8 个与最低 4 个；完整列表见下方「单对象」图）' : '')
      + '纵轴已按 2%~98% 分位裁剪，极端值不显示以免压缩其他曲线。', '盈利' + kind + cat);
    grid.appendChild(card);
    var chart = echarts.init(card.querySelector('.card-body'));
    var opt = baseLineOption(unit);
    // 纵轴按分位裁剪，避免极端值压扁整体
    var allv = [];
    shown.forEach(function (s) {
      s.values.forEach(function (v) { if (v != null && isFinite(v)) allv.push(v); });
    });
    if (allv.length > 8) {
      allv.sort(function (a, b) { return a - b; });
      var q = function (p) { return allv[Math.min(allv.length - 1, Math.max(0, Math.floor(allv.length * p)))]; };
      var lo = q(0.02), hi = q(0.98);
      if (kind === 'profit') {
        opt.yAxis.min = Math.max(Math.min(lo, 0) * 1.15, -300);
        opt.yAxis.max = Math.min(hi * 1.15, 400);
      }
    }
    opt.legend = { top: 2, type: 'scroll', icon: 'roundRect', itemWidth: 12, itemHeight: 3,
      textStyle: { fontSize: 11, color: '#4b5563' } };
    opt.series = shown.map(function (s) {
      return { name: s.name, type: 'line', showSymbol: false, connectNulls: true,
        lineStyle: { width: 1.4 }, emphasis: { focus: 'series' },
        data: pairDates(s.dates, s.values) };
    });
    chart.setOption(opt);
    charts.push(chart);
    addZoomHover(card, chart);
    registerCard(card, chart, title + cat + ' ' + shown.map(function (s) { return s.name; }).join(' '));
  }

  // 单对象两张图：净利润增速（末端 26E 点 + 本周vs上周标注）、ROE-TTM
  function earnPickers(grid, cat, label) {
    var pList = earnSeriesOf(cat, 'profit');
    var rList = earnSeriesOf(cat, 'roe');
    var names = [];
    pList.concat(rList).forEach(function (s) { if (names.indexOf(s.name) < 0) names.push(s.name); });
    if (!names.length) return;

    function mkPicker(title, unit, note, key) {
      var card = makeCard(title, unit, '2026-09-20', true, note, key);
      var head = card.querySelector('.card-header');
      var sel = document.createElement('select');
      sel.className = 'roll-select';
      names.forEach(function (n) {
        var o = document.createElement('option'); o.value = n; o.textContent = n; sel.appendChild(o);
      });
      head.insertBefore(sel, card.querySelector('.card-date'));
      grid.appendChild(card);
      var chart = echarts.init(card.querySelector('.card-body'));
      charts.push(chart);
      addZoomHover(card, chart);
      return { card: card, chart: chart, sel: sel };
    }

    var P = mkPicker('净利润增速 · 单' + label + '（%，同比）', '%',
      '季度/年度同比增速（历史为实际值），末端菱形点为 26E/27E 一致预期，红色标注为本周相对上周的调整（↑上调/↓下调，单位 pp）。下拉切换对象。',
      '盈利单' + cat + 'P');
    var R = mkPicker('ROE-TTM · 单' + label + '（%）', '%',
      'ROE-TTM 季度序列（2015Q1 起）。下拉切换对象。', '盈利单' + cat + 'R');

    function loadP(name) {
      var s = pList.filter(function (x) { return x.name === name; })[0];
      var opt = baseLineOption('%');
      if (!s) { P.chart.setOption(opt); return; }
      var pts = pairDates(s.dates, s.values);
      var cmp = earnCmpOf(cat, name);
      var extra = [];
      if (cmp) {
        var lastY = Number((s.dates[s.dates.length - 1] || '2026-06-30').slice(0, 4));
        var fy26 = Math.max(lastY, 2026);
        if (cmp.g26e != null) extra.push(['2026-12-31', cmp.g26e]);
        if (cmp.g27e != null) extra.push(['2027-12-31', cmp.g27e]);
        if (cmp.g26e != null && fy26 > 2026) extra[0] = [fy26 + '-12-31', cmp.g26e];
      }
      var line = pts.concat(extra);
      opt.series = [{ name: name, type: 'line', showSymbol: false, connectNulls: true,
        lineStyle: { width: 1.9, color: '#2563eb' }, itemStyle: { color: '#2563eb' },
        emphasis: { focus: 'series' }, data: line }];
      // 26E 点标注：数值 + 本周vs上周调整
      if (cmp && cmp.g26e != null) {
        var chg = cmp.chg_pp;
        var txt;
        if (chg == null || Math.abs(chg) < 0.05) {
          txt = '{v|' + num1(cmp.g26e) + '}';
        } else {
          txt = '{v|' + num1(cmp.g26e) + '}\n' + (chg >= 0 ? '↑' : '↓') + Math.abs(chg).toFixed(1) + 'pp\n{c|vs上周}';
        }
        opt.series[0].markPoint = {
          symbol: 'diamond', symbolSize: 11,
          itemStyle: { color: '#dc2626' },
          label: {
            show: true, position: 'top', distance: 6, fontSize: 11, lineHeight: 14,
            formatter: txt,
            rich: { v: { color: '#dc2626', fontWeight: 'bold', fontSize: 12 },
                    c: { color: '#9ca3af', fontSize: 9 } }
          },
          data: [{ coord: ['2026-12-31', cmp.g26e], value: cmp.g26e }]
        };
        if (extra.length && extra[0][0] !== '2026-12-31') {
          opt.series[0].markPoint.data = [{ coord: extra[0], value: cmp.g26e }];
        }
      }
      P.chart.setOption(opt);
    }

    function loadR(name) {
      var s = rList.filter(function (x) { return x.name === name; })[0];
      var opt = baseLineOption('%');
      opt.series = s ? [{ name: name, type: 'line', showSymbol: false, connectNulls: true,
        lineStyle: { width: 1.9, color: '#7c3aed' }, itemStyle: { color: '#7c3aed' },
        emphasis: { focus: 'series' }, data: pairDates(s.dates, s.values) }] : [];
      R.chart.setOption(opt);
    }

    P.sel.onchange = function () { loadP(P.sel.value); };
    R.sel.onchange = function () { loadR(R.sel.value); };
    if (pList.length) { P.sel.value = pList[0].name; loadP(pList[0].name); }
    if (rList.length) { R.sel.value = rList[0].name; loadR(rList[0].name); }
  }

  // 风格历史增速（2010-2026E 年度，作为风格子页补充）
  function styleHistory(grid) {
    var hist = D.earnings.style_history;
    if (!hist || !hist.years) return;
    var years = hist.years;
    var card = makeCard('风格指数年度盈利增速（2010-2026E）', '%', '2026-09-20', true,
      '历史为实际增速；2025/2026E 为一致预期。覆盖中信风格/申万大小盘/高低估值/高低盈利/动量反转等。', '风格历史增速');
    grid.appendChild(card);
    var chart = echarts.init(card.querySelector('.card-body'));
    var opt = baseLineOption('%');
    opt.legend = { top: 2, type: 'scroll', icon: 'roundRect', itemWidth: 12, itemHeight: 3,
      textStyle: { fontSize: 11, color: '#4b5563' } };
    opt.series = hist.series.map(function (s) {
      return { name: s.name, type: 'line', showSymbol: false, connectNulls: true,
        lineStyle: { width: 1.4 }, emphasis: { focus: 'series' },
        data: years.map(function (y, yi) {
          return [y.length === 4 ? y + '-12-31' : y, s.values[yi]];
        }).filter(function (d) { return d[1] != null; }) };
    });
    chart.setOption(opt);
    charts.push(chart);
    addZoomHover(card, chart);
    registerCard(card, chart, '风格历史增速 ' + hist.series.map(function (s) { return s.name; }).join(' '));
  }

  function renderEarnings(container, section) {
    var grid = document.createElement('div');
    grid.className = 'grid';
    container.appendChild(grid);
    EARN_PAGES.forEach(function (pg) {
      if (section && section !== pg.sec) return;
      var h = document.createElement('div');
      h.className = 'section-title';
      h.textContent = pg.label + '（净利润增速 · ROE · 时间序列）';
      grid.appendChild(h);
      earnOverview(grid, pg.cat, pg.label, 'profit', '净利润增速（同比）', '%',
        '所属对象的净利润同比增速时间序列。行业为季度（iFinD 板块口径，2019 起），风格为年度（2010 起）。');
      earnOverview(grid, pg.cat, pg.label, 'roe', 'ROE-TTM', '%',
        'ROE-TTM 季度序列（底稿口径，2015Q1 起）。');
      earnPickers(grid, pg.cat, pg.label);
      if (pg.cat === '风格') styleHistory(grid);
    });
  }

  function renderERP(container) {
    var erp = D.sentiment.erp;
    var dates = erp.dates, vals = erp.erp, closes = erp.close;
    var ERP_WINDOWS = [
      { label: '滚动1年', days: 252 },
      { label: '滚动3年', days: 756 },
      { label: '滚动5年', days: 1260 }
    ];
    var card = makeCard('ERP · 股权风险溢价（中证全指）', '%', dates[dates.length - 1], true,
      'ERP = 100/中证全指PE-TTM − 中债10Y国债收益率（%）。红/蓝线为滚动窗口均值 ± 2×标准差，窗口不足时从满窗起画。灰线为右轴中证全指收盘。'
      + '当前ERP处于5年±2SD通道位置=股债性价比水位。数据（截至' + dates[dates.length - 1] + '）；与全A口径交叉验证偏差约+0.1~0.4pp。', 'ERP');
    var head = card.querySelector('.card-header');
    var sel = document.createElement('select');
    sel.className = 'roll-select';
    ERP_WINDOWS.forEach(function (w) {
      var op = document.createElement('option');
      op.value = w.days; op.textContent = w.label;
      if (w.days === 1260) op.selected = true;
      sel.appendChild(op);
    });
    head.insertBefore(sel, card.querySelector('.card-date'));
    container.appendChild(card);
    var chart = echarts.init(card.querySelector('.card-body'));
    var opt = baseLineOption('%');
    opt.grid.right = 56;
    opt.yAxis = [
      { type: 'value', scale: true, axisLabel: { color: '#6b7280', fontSize: 11 },
        splitLine: { lineStyle: { color: '#eef1f6' } } },
      { type: 'value', scale: true, position: 'right',
        axisLabel: { color: '#94a3b8', fontSize: 11 }, splitLine: { show: false } }
    ];
    opt.series = [
      { name: 'ERP', type: 'line', showSymbol: false, lineStyle: { width: 1.8, color: '#1e56b0' },
        itemStyle: { color: '#1e56b0' }, emphasis: { focus: 'series' },
        data: pairDates(dates, vals) },
      { name: '均值', type: 'line', showSymbol: false, lineStyle: { width: 1.8, color: '#b03a2e' },
        itemStyle: { color: '#b03a2e' }, data: [] },
      { name: '均值-2SD', type: 'line', showSymbol: false, lineStyle: { width: 1.2, color: '#5dade2' },
        itemStyle: { color: '#5dade2' }, data: [] },
      { name: '均值+2SD', type: 'line', showSymbol: false, lineStyle: { width: 1.2, color: '#5dade2' },
        itemStyle: { color: '#5dade2' }, data: [] },
      { name: '中证全指（右轴）', type: 'line', showSymbol: false, yAxisIndex: 1,
        lineStyle: { width: 1, color: '#94a3b8', opacity: .85 },
        itemStyle: { color: '#94a3b8' }, data: pairDates(dates, closes) }
    ];
    function applyow(days) {
      var st = rollingMeanSD(vals, days);
      chart.setOption({ series: [
        {},
        { data: pairDates(dates, st.mean) },
        { data: pairDates(dates, st.mean.map(function (m, i) { return m == null ? null : m - 2 * st.sd[i]; })) },
        { data: pairDates(dates, st.mean.map(function (m, i) { return m == null ? null : m + 2 * st.sd[i]; })) },
        {}
      ] });
    }
    sel.onchange = function () { applyow(+sel.value); };
    chart.setOption(opt);
    applyow(1260);
    charts.push(chart);
    addZoomHover(card, chart);
    registerCard(card, chart, 'ERP 股权风险溢价 中证全指 股债性价比 均值 标准差');
  }

  function breadthChart(container, title, values, refLines, unit, note, key) {
    var b = D.sentiment.breadth;
    var card = makeCard(title, unit, b.dates[b.dates.length - 1], false, note, key);
    container.appendChild(card);
    var chart = echarts.init(card.querySelector('.card-body'));
    var opt = baseLineOption(unit);
    opt.series = [{
      name: title, type: 'line', showSymbol: false,
      lineStyle: { width: 1.8, color: '#2563eb' }, itemStyle: { color: '#2563eb' },
      emphasis: { focus: 'series' },
      data: pairDates(b.dates, values)
    }];
    if (refLines) {
      opt.series[0].markLine = { silent: true, symbol: 'none',
        lineStyle: { type: 'dashed', width: 1 },
        data: refLines.map(function (r) {
          return { yAxis: r.v, lineStyle: { color: r.c },
            label: { formatter: r.t, fontSize: 10, color: r.c } };
        }) };
    }
    chart.setOption(opt);
    charts.push(chart);
    addZoomHover(card, chart);
    registerCard(card, chart, title);
  }

  function dividendChart(container) {
    var dv = D.sentiment.dividend;
    var card = makeCard('红利股息率 vs 10Y国债（股债收益差）', '%', dv.dates[dv.dates.length - 1], false,
      '中证红利股息率与中债10Y国债收益率。'
      + '股息率−国债=红利资产相对债券的性价比；股息率历史上极少低于国债收益率（跑输即红利极度拥挤/债券利率极高）。', '红利股息率');
    container.appendChild(card);
    var chart = echarts.init(card.querySelector('.card-body'));
    var opt = baseLineOption('%');
    opt.series = [
      { name: '中证红利股息率', type: 'line', showSymbol: false,
        lineStyle: { width: 1.8, color: '#dc2626' }, itemStyle: { color: '#dc2626' },
        areaStyle: { color: 'rgba(220,38,38,0.06)' },
        emphasis: { focus: 'series' }, data: pairDates(dv.dates, dv.dy) },
      { name: '10Y国债收益率', type: 'line', showSymbol: false,
        lineStyle: { width: 1.6, color: '#2563eb' }, itemStyle: { color: '#2563eb' },
        emphasis: { focus: 'series' }, data: pairDates(dv.dates, dv.y10) }
    ];
    chart.setOption(opt);
    charts.push(chart);
    addZoomHover(card, chart);
    registerCard(card, chart, '红利 股息率 国债 股债收益差 中证红利');
  }

  function industrySentChart(container) {
    var ind = D.sentiment.industry;
    var inds = ind.industries;
    var dates = ind.dates;
    var card = makeCard('行业情绪指标（60日口径）', '', dates[dates.length - 1], true,
      '情绪 = (偏离度60日分位 + 成交额占比MA5的60日分位) / 2，范围 0~100。'
      + '偏离度=收盘/MA60−1；成交额占比=行业成交额/30行业合计的5日均值。'
      + '90以上过热、10以下过冷。中信一级行业口径（与估值/盈利的申万口径名称基本对应）。'
      + '<br><b>用法</b>：情绪是<b>行业间再平衡</b>的参考——过热行业未来60个交易日相对跑输（超额约−1.4pp），'
      + '但不宜作绝对减仓信号（20日内动量仍在，减仓易少赚）。真正的信号是分位的方向变化而非绝对值。', '行业情绪指标');
    var head = card.querySelector('.card-header');
    var sel = document.createElement('select');
    sel.className = 'roll-select';
    inds.forEach(function (s) {
      var op = document.createElement('option');
      op.value = s.name; op.textContent = s.name;
      sel.appendChild(op);
    });
    head.insertBefore(sel, card.querySelector('.card-date'));
    container.appendChild(card);
    var chart = echarts.init(card.querySelector('.card-body'));
    var opt = baseLineOption('');
    opt.grid.right = 56;
    opt.yAxis = [
      { type: 'value', scale: true, name: '价格',
        axisLabel: { color: '#6b7280', fontSize: 11 },
        splitLine: { lineStyle: { color: '#eef1f6' } } },
      { type: 'value', min: 0, max: 100, name: '情绪(0-100)', position: 'right',
        axisLabel: { color: '#94a3b8', fontSize: 11 }, splitLine: { show: false } }
    ];
    opt.series = [
      { name: '行业指数价格', type: 'line', showSymbol: false,
        lineStyle: { width: 1.5, color: '#2563eb' }, itemStyle: { color: '#2563eb' },
        emphasis: { focus: 'series' }, data: [] },
      { name: '情绪(60日口径)', type: 'line', showSymbol: false, yAxisIndex: 1,
        lineStyle: { width: 1.8, color: '#dc2626' }, itemStyle: { color: '#dc2626' },
        emphasis: { focus: 'series' }, data: [],
        markLine: { silent: true, symbol: 'none',
          lineStyle: { type: 'dashed', width: 1 },
          data: [
            { yAxis: 90, lineStyle: { color: '#dc2626' }, label: { formatter: '过热 90', fontSize: 10, color: '#dc2626' } },
            { yAxis: 50, lineStyle: { color: '#94a3b8' }, label: { formatter: '中性 50', fontSize: 10, color: '#94a3b8' } },
            { yAxis: 10, lineStyle: { color: '#16a34a' }, label: { formatter: '过冷 10', fontSize: 10, color: '#16a34a' } }
          ] } },
      { name: '偏离度分位', type: 'line', showSymbol: false, yAxisIndex: 1,
        lineStyle: { width: 1.2, color: '#d97706', opacity: .8 }, itemStyle: { color: '#d97706' },
        emphasis: { focus: 'series' }, data: [] },
      { name: '成交额占比分位', type: 'line', showSymbol: false, yAxisIndex: 1,
        lineStyle: { width: 1.2, color: '#16a34a', opacity: .8 }, itemStyle: { color: '#16a34a' },
        emphasis: { focus: 'series' }, data: [] }
    ];
    function load(name) {
      var s = inds.filter(function (x) { return x.name === name; })[0];
      if (!s) return;
      chart.setOption({ series: [
        { data: pairDates(dates, s.close) },
        { data: pairDates(dates, s.sent) },
        { data: pairDates(dates, s.dev_p60) },
        { data: pairDates(dates, s.amt_p60) }
      ] });
    }
    sel.onchange = function () { load(sel.value); };
    chart.setOption(opt);
    var first = inds.filter(function (x) { return x.name === '电子'; })[0];
    var firstName = first ? first.name : inds[0].name;
    sel.value = firstName;
    load(firstName);
    charts.push(chart);
    addZoomHover(card, chart);
    registerCard(card, chart, '行业情绪指标 ' + inds.map(function (s) { return s.name; }).join(' '));
  }

  function industryHeatmap(container) {
    var ind = D.sentiment.industry;
    var dates = ind.dates, inds = ind.industries;
    var N = 20;
    var sliceDates = dates.slice(-N);
    var arr = [];
    inds.forEach(function (s, yi) {
      var vals = s.sent.slice(-N);
      for (var xi = 0; xi < N; xi++) {
        if (vals[xi] != null) arr.push([N - 1 - xi, yi, Math.round(vals[xi])]);
      }
    });
    var card = makeCard('截面情绪热力图（60日口径 · 最近20个交易日）', '', dates[dates.length - 1], true, null, '截面情绪热力图');
    var body = card.querySelector('.card-body');
    body.style.height = '680px';
    container.appendChild(card);
    var anno = document.createElement('div');
    anno.className = 'card-note';
    anno.style.cssText = 'line-height:2;font-size:13px;padding-top:8px;';
    card.appendChild(anno);
    var chart = echarts.init(body);
    var li = dates.length - 1;
    var hot = [], cold = [];
    inds.forEach(function (s) {
      var v = s.sent[li];
      if (v == null) return;
      if (v >= 80) hot.push(s.name + '(' + Math.round(v) + ')');
      if (v <= 20) cold.push(s.name + '(' + Math.round(v) + ')');
    });
    function fmt(a) { return a.length ? a.join('、') : '无'; }
    anno.innerHTML =
      '<span style="color:#dc2626;font-weight:600;">▍情绪过热(≥80)：' + fmt(hot) + '</span><br>' +
      '<span style="color:#16a34a;font-weight:600;">▍情绪过冷(≤20)：' + fmt(cold) + '</span>';
    chart.setOption({
      animation: false,
      grid: { left: 120, right: 64, top: 14, bottom: 60 },
      xAxis: { type: 'category',
        data: sliceDates.map(function (d) { return d.slice(5); }).reverse(),
        axisLine: { lineStyle: { color: '#d5dae3' } },
        axisLabel: { color: '#6b7280', fontSize: 9, rotate: 45 },
        splitArea: { show: false } },
      yAxis: { type: 'category', data: inds.map(function (s) { return s.name; }), inverse: true,
        axisLine: { lineStyle: { color: '#d5dae3' } },
        axisLabel: { color: '#374151', fontSize: 11 } },
      visualMap: { min: 0, max: 100, calculable: false, orient: 'vertical',
        right: 2, top: 'center', itemHeight: 260,
        text: ['100', '0'], textStyle: { color: '#6b7280', fontSize: 10 },
        inRange: { color: ['#053061', '#2166ac', '#4393c3', '#92c5de', '#d1e5f0',
                           '#f7f7f7', '#fddbc7', '#f4a582', '#d6604d', '#b2182b', '#67000d'] } },
      tooltip: { backgroundColor: 'rgba(255,255,255,.96)', borderColor: '#e5e8ef',
        textStyle: { color: '#1f2430', fontSize: 12 },
        formatter: function (p) {
          var x = N - 1 - p.value[0];
          return inds[p.value[1]].name + '｜' + sliceDates[x] + '｜情绪 ' + p.value[2];
        } },
      series: [{ type: 'heatmap', data: arr,
        label: { show: true, fontSize: 8.5, color: '#1f2937',
                 formatter: function (p) { return p.value[2]; } },
        itemStyle: { borderColor: '#ffffff', borderWidth: 1.5 },
        emphasis: { itemStyle: { shadowBlur: 6, shadowColor: 'rgba(0,0,0,0.3)' } } }]
    });
    charts.push(chart);
    registerCard(card, chart, '截面情绪热力图 ' + inds.map(function (s) { return s.name; }).join(' '));
  }

  function industryRankBar(container) {
    var ind = D.sentiment.industry;
    var li = ind.dates.length - 1;
    var rows = ind.industries
      .map(function (s) { return { name: s.name, v: s.sent[li], d: s.dev_p60[li], a: s.amt_p60[li], v250: null }; })
      .filter(function (r) { return r.v != null; })
      .sort(function (a, b) { return b.v - a.v; });
    var card = makeCard('行业情绪排序（最新 · 60日口径）', '', ind.dates[li], true,
      '每行两根并列条：橙=偏离度30日分位，绿=成交额占比30日分位；左侧数字=综合情绪（括号内为250日口径）。按综合情绪降序。', '行业情绪排序');
    container.appendChild(card);
    var chart = echarts.init(card.querySelector('.card-body'));
    chart.setOption({
      color: ['#d97706', '#16a34a'],
      grid: { left: 110, right: 46, top: 30, bottom: 26 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' },
        backgroundColor: 'rgba(255,255,255,.96)', borderColor: '#e5e8ef',
        textStyle: { color: '#1f2430', fontSize: 12 },
        formatter: function (ps) {
          var r = rows[ps[0].dataIndex];
          return r.name + '<br>综合情绪(30日): ' + Math.round(r.v) +
            '（250日: ' + (r.v250 != null ? Math.round(r.v250) : '-') + '）<br>偏离度分位: ' +
            (r.d != null ? Math.round(r.d) : '-') + '<br>成交占比分位: ' + (r.a != null ? Math.round(r.a) : '-');
        } },
      legend: { top: 2, data: ['偏离度分位', '成交占比分位'], icon: 'roundRect', itemWidth: 14, itemHeight: 3,
        textStyle: { fontSize: 11, color: '#4b5563' } },
      xAxis: { type: 'value', max: 100,
        axisLabel: { color: '#6b7280', fontSize: 10 }, splitLine: { lineStyle: { color: '#eef1f6' } } },
      yAxis: { type: 'category', data: rows.map(function (r) { return r.name; }), inverse: true,
        axisLine: { lineStyle: { color: '#d5dae3' } },
        axisLabel: { color: '#374151', fontSize: 11 } },
      series: [
        { name: '偏离度分位', type: 'bar', data: rows.map(function (r) { return r.d; }), barMaxWidth: 9,
          itemStyle: { borderRadius: [0, 2, 2, 0] } },
        { name: '成交占比分位', type: 'bar', data: rows.map(function (r) { return r.a; }), barMaxWidth: 9,
          itemStyle: { borderRadius: [0, 2, 2, 0] } }
      ]
    });
    charts.push(chart);
    registerCard(card, chart, '行业情绪排序 ' + rows.map(function (r) { return r.name; }).join(' '));
  }

  function renderSentiment(container, section) {
    if (!section || section === '大盘情绪') {
      var h = document.createElement('div'); h.className = 'section-title'; h.textContent = '大盘情绪';
      container.appendChild(h);
      renderERP(container);
      var grid1 = document.createElement('div');
      grid1.className = 'grid';
      container.appendChild(grid1);
      breadthChart(grid1, '站上30日均线个股比例（全A）', D.sentiment.breadth.above_ma30_pct,
        [{ v: 70, c: '#dc2626', t: '70%' }, { v: 50, c: '#94a3b8', t: '50%' }, { v: 30, c: '#16a34a', t: '30%' }],
        '%', '全A个股收盘价>其30日均线（不复权）的比例。全A个股（5591只）逐日计算，2025-07起。>70%普涨过热、<30%普跌超卖。', '站上30日均线比例');
      breadthChart(grid1, '全A日成交额', D.sentiment.breadth.all_a_amt_yi,
        null, '千亿元', '全A成交额（由个股面板加总，20千亿元=2万亿元量能水位）。', '全A成交额');
    }
    if (!section || section === '风格情绪') {
      var h2 = document.createElement('div'); h2.className = 'section-title'; h2.textContent = '风格情绪';
      container.appendChild(h2);

      // 风格结论总结卡
      var styleCard0 = makeCard('风格判断总结（谁占优？）', '', '2026-09-18', true, null, '风格总结');
      var sb = styleCard0.querySelector('.card-body');
      sb.style.height = 'auto';
      sb.style.padding = '6px 16px 14px';
      sb.style.fontSize = '12.5px';
      sb.style.lineHeight = '1.9';
      sb.style.color = 'var(--text-sub)';
      var lastHL = D.sentiment.styleDiff ? D.sentiment.styleDiff.hl : null;
      var lastGV = D.sentiment.styleDiff ? D.sentiment.styleDiff.gv : null;
      var lastTR = D.sentiment.styleDiff ? D.sentiment.styleDiff.tr : null;
      var hlLast = lastHL ? lastHL.diff[lastHL.diff.length - 1] : null;
      var gvLast = lastGV ? lastGV.diff[lastGV.diff.length - 1] : null;
      var trLast = lastTR ? lastTR.diff[lastTR.diff.length - 1] : null;
      var top5Last = D.sentiment.breadth.top5_amt_share[D.sentiment.breadth.top5_amt_share.length - 1];
      var divLast = D.sentiment.dividend.dy[D.sentiment.dividend.dy.length - 1];
      var y10Last = null;
      for (var i = D.sentiment.dividend.y10.length - 1; i >= 0; i--) { if (D.sentiment.dividend.y10[i] != null) { y10Last = D.sentiment.dividend.y10[i]; break; } }
      var spread = divLast - y10Last;
      var spreadBase = (D.sentiment.dividend && D.sentiment.dividend.stat) || null;
      sb.innerHTML =
        '<table style="width:100%;border-collapse:collapse;font-size:12px;">'
        + '<tr><td style="padding:6px;border-bottom:1px solid var(--border);"><b>高估值 vs 低估值</b></td><td style="padding:6px;border-bottom:1px solid var(--border);">'
        + (hlLast != null && hlLast > 0.05 ? '<span style="color:var(--red);">高估值占优</span>' : (hlLast != null && hlLast < -0.05 ? '<span style="color:var(--green);">低估值占优</span>' : '<span>均衡</span>'))
        + '<span style="color:var(--text-faint);">（40日收益差 ' + num1(hlLast != null ? hlLast * 100 : null) + '%）</span></td></tr>'
        + '<tr><td style="padding:6px;border-bottom:1px solid var(--border);"><b>成长 vs 价值</b></td><td style="padding:6px;border-bottom:1px solid var(--border);">'
        + (gvLast != null && gvLast > 0.05 ? '<span style="color:var(--red);">成长占优</span>' : (gvLast != null && gvLast < -0.05 ? '<span style="color:var(--green);">价值占优</span>' : '<span>均衡</span>'))
        + '<span style="color:var(--text-faint);">（40日收益差 ' + num1(gvLast != null ? gvLast * 100 : null) + '%）</span></td></tr>'
        + '<tr><td style="padding:6px;border-bottom:1px solid var(--border);"><b>TMT vs 红利</b></td><td style="padding:6px;border-bottom:1px solid var(--border);">'
        + (trLast != null && trLast > 0.05 ? '<span style="color:var(--red);">TMT占优</span>' : (trLast != null && trLast < -0.05 ? '<span style="color:var(--green);">红利占优</span>' : '<span>均衡</span>'))
        + '<span style="color:var(--text-faint);">（40日收益差 ' + num1(trLast != null ? trLast * 100 : null) + '%）</span></td></tr>'
        + '<tr><td style="padding:6px;border-bottom:1px solid var(--border);"><b>大盘 vs 小盘</b></td><td style="padding:6px;border-bottom:1px solid var(--border);">'
        + (top5Last != null && top5Last > 50 ? '<span style="color:var(--red);">资金集中大盘</span>' : '<span style="color:var(--green);">资金扩散小盘</span>')
        + '<span style="color:var(--text-faint);">（前5%成交占比 ' + num1(top5Last) + '%；>50%=集中，<45%=扩散，45→35%=小盘超额窗口）</span></td></tr>'
        + '<tr><td style="padding:6px;"><b>红利 vs 债券</b></td><td style="padding:6px;">'
        + (function () {
          if (spread == null || isNaN(spread)) return '<span>—</span>';
          var sb = spreadBase;
          var hasBase = sb && sb.avg5 != null;
          var above5 = hasBase && spread >= sb.avg5;
          var head = (above5 && spread > 2) ? '<span style="color:var(--red);">红利性价比高</span>'
                   : (spread > 2 ? '<span style="color:#d97706;">性价比中性偏高</span>' : '<span>性价比一般</span>');
          var dropped = sb && sb.jun != null && spread < sb.jun - 0.1;
          return head + '<span style="color:var(--text-faint);">（'
            + (dropped ? '较6月底回落 ' + num1(sb.jun - spread) + 'pp，' : '')
            + (hasBase ? (above5 ? '高于' : '低于') + '近5年均值 ' + num1(Math.abs(spread - sb.avg5)) + 'pp' : '')
            + '）</span>';
        }())
        + '<span style="color:var(--text-faint);">（股息率 ' + num1(divLast) + '% − 10Y国债 ' + num1(y10Last) + '%'
        + ' = 利差 ' + num1(spread) + 'pp；'
        + (spreadBase ? '较 6月底 ' + num1(spreadBase.jun) + 'pp 回落 ' + num1(Math.abs(spread - spreadBase.jun)) + 'pp，'
          + '近5年均值 ' + num1(spreadBase.avg5) + 'pp（当前' + (spread >= spreadBase.avg5 ? '高于' : '低于') + '均值 '
          + num1(Math.abs(spread - spreadBase.avg5)) + 'pp，近5年 ' + num1(spreadBase.pct) + '% 分位）' : '')
        + '）</span></td></tr>'
        + '</table>';
      container.appendChild(styleCard0);
      registerCard(styleCard0, null, '风格判断 总结 高估值 低估值 成长 价值 TMT 红利 大盘 小盘 谁占优');

      crowdingMethodCard(container);
      ['hl', 'gv', 'tr'].forEach(function (k) { styleDiffChart(container, k); });
      var grid2 = document.createElement('div');
      grid2.className = 'grid';
      container.appendChild(grid2);
      breadthChart(grid2, '前5%个股成交额占比（大小盘资金集中度）', D.sentiment.breadth.top5_amt_share,
        null, '%',
        '每日按个股成交额降序，取前5%数量个股的成交额合计 / 全A总成交额（资金面看板同口径算法）。'
        + '占比高=资金集中于头部（大盘/核心资产行情），占比低=扩散至小微盘。', '前5%成交占比');
      dividendChart(grid2);
    }
    if (!section || section === '行业情绪') {
      var h3 = document.createElement('div'); h3.className = 'section-title'; h3.textContent = '行业情绪（中信一级 · 30个）';
      container.appendChild(h3);
      industrySentChart(container);
      industryRankBar(container);
      industryHeatmap(container);
    }
    if (!section || section === '机构持仓') {
      var h4 = document.createElement('div'); h4.className = 'section-title'; h4.textContent = '机构持仓（公募超配/欠配 · 申万口径 · 季频）';
      container.appendChild(h4);
      renderFund(container);
    }
  }

  /* ---------------- 机构持仓（公募超配/欠配，西部底稿） ---------------- */
  function fundOverBar(container, list, title, key, note) {
    var F = D.sentiment.fund;
    var li = F.dates.length - 1;
    var rows = list
      .map(function (s) { return { name: s.name, cfg: s.config[li], ov: s.over[li] }; })
      .filter(function (r) { return r.ov != null; })
      .sort(function (a, b) { return b.ov - a.ov; });
    var card = makeCard(title, 'pp', F.dates[li], true, note, key);
    container.appendChild(card);
    var chart = echarts.init(card.querySelector('.card-body'));
    chart.setOption({
      grid: { left: 96, right: 56, top: 16, bottom: 30 },
      tooltip: { trigger: 'item',
        backgroundColor: 'rgba(255,255,255,.96)', borderColor: '#e5e8ef',
        textStyle: { color: '#1f2430', fontSize: 12 },
        formatter: function (p) {
          var r = rows[p.dataIndex];
          return r.name + '<br>基金配置: ' + (r.cfg != null ? (r.cfg * 100).toFixed(1) + '%' : '-') +
            '<br>超配: ' + (r.ov * 100).toFixed(1) + ' pp';
        } },
      xAxis: { type: 'value',
        axisLabel: { color: '#6b7280', fontSize: 11,
          formatter: function (v) { return v.toFixed(0); } },
        splitLine: { lineStyle: { color: '#eef1f6' } } },
      yAxis: { type: 'category', data: rows.map(function (r) { return r.name; }), inverse: true,
        axisLine: { lineStyle: { color: '#d5dae3' } },
        axisLabel: { color: '#374151', fontSize: 11 } },
      series: [{ type: 'bar', barMaxWidth: 12,
        data: rows.map(function (r) {
          var v = +(r.ov * 100).toFixed(2);
          return { value: v,
            label: { show: true, position: v >= 0 ? 'right' : 'left', fontSize: 9, color: '#9ca3af',
                     formatter: (r.cfg != null ? Math.round(r.cfg * 100) + '%' : '') },
            itemStyle: { color: v >= 0 ? '#dc2626' : '#16a34a',
                         borderRadius: v >= 0 ? [0, 3, 3, 0] : [3, 0, 0, 3] } };
        }),
        markLine: { silent: true, symbol: 'none',
          lineStyle: { color: '#c3c9d4', type: 'dashed', width: 1 },
          data: [{ xAxis: 0 }], label: { show: false } }
      }]
    });
    charts.push(chart);
    registerCard(card, chart, key + ' 超配 欠配 公募持仓 ' + rows.map(function (r) { return r.name; }).join(' '));
  }

  function fundTimeline(container) {
    var F = D.sentiment.fund;
    var dates = F.dates.map(function (d) { return d.slice(0, 10); });
    var opts = [];
    F.l1.forEach(function (s) { opts.push({ t: s.name + '（一级）', s: s }); });
    F.l2.forEach(function (s) { opts.push({ t: s.name + '（二级）', s: s }); });
    var card = makeCard('单行业公募超配比例走势（2003Q1 起 · 季度）', 'pp', dates[dates.length - 1], true,
      '主动偏股基金重仓股相对全市场流通权重的超配比例（正=超配，负=欠配）。历史20+年可观察抱团-瓦解周期。'
      + '更新频率：季报披露（季度/半年），给观者大致认知用。', '公募超配走势');
    var head = card.querySelector('.card-header');
    var sel = document.createElement('select');
    sel.className = 'roll-select';
    opts.forEach(function (o) {
      var op = document.createElement('option');
      op.value = o.t; op.textContent = o.t;
      sel.appendChild(op);
    });
    sel.value = '电子（一级）';
    head.insertBefore(sel, card.querySelector('.card-date'));
    container.appendChild(card);
    var chart = echarts.init(card.querySelector('.card-body'));
    var opt = baseLineOption('pp');
    opt.series = [{ type: 'line', showSymbol: false,
      lineStyle: { width: 1.8, color: '#dc2626' }, itemStyle: { color: '#dc2626' },
      emphasis: { focus: 'series' }, data: [],
      markLine: { silent: true, symbol: 'none',
        lineStyle: { color: '#9ca3af', type: 'dashed', width: 1 },
        data: [{ yAxis: 0 }], label: { show: false } } }];
    function load(t) {
      var o = opts.filter(function (x) { return x.t === t; })[0];
      if (!o) return;
      chart.setOption({ series: [{ name: t, data: pairDates(dates, o.s.over.map(function (v) { return v == null ? null : +(v * 100).toFixed(2); })) }] });
    }
    sel.onchange = function () { load(sel.value); };
    chart.setOption(opt);
    load(sel.value);
    charts.push(chart);
    addZoomHover(card, chart);
    registerCard(card, chart, '公募超配走势 ' + opts.map(function (o) { return o.t; }).join(' '));
  }

  function renderFund(container) {
    var F = D.sentiment.fund;
    var li = F.dates.length - 1;
    var l2Sorted = F.l2.slice().sort(function (a, b) {
      var va = a.over[li], vb = b.over[li];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      return vb - va;
    });
    var l2Top = l2Sorted.slice(0, 15).concat(l2Sorted.slice(-15));

    fundOverBar(container, F.l1, '公募基金行业配置比例（' + F.dates[li].slice(0, 7) + '）· 柱状=配置比例(pp)', '公募超配一级',
      '柱状=公募重仓股行业配置比例相对全市场流通权重的偏离(pp)。正值=超配，负值=欠配。'
      + '一级口径由131个二级行业加总。更新频率：季报（约季度一次）。');
    fundOverBar(container, l2Top, '公募基金配置比例 · 申万二级行业 Top15 + Bottom15（' + F.dates[li].slice(0, 7) + '）', '公募超配二级',
      '按最新一期配置比例偏离排序，仅展示超配最高15个与欠配最深15个二级行业（完整131个见下拉走势图）。');
    fundTimeline(container);
  }

  /* ---------------- 风格收益差（±10%/±20% 阈值） ---------------- */
  function styleDiffChart(container, key) {
    var P = D.sentiment.styleDiff[key];
    if (!P) return;
    var dates = P.dates, diff = P.diff, ratio = P.ratio;
    var li = 0;
    for (var i = 0; i < diff.length; i++) if (diff[i] != null) li = i;
    var card = makeCard('风格收益差 · ' + P.title, '%', dates[li], true,
      P.a_name + '（' + P.a_code + '）相对 ' + P.b_name + '（' + P.b_code + '）的40个交易日收益差。'
      + '±10%/±20% 阈值：收益差冲破±20%往往对应风格极致化，'
      + '随后多出现风格再平衡（如2024-11高−低达+47%历史极值后深度回落）。红线为右轴两指数比价。'
      + (key === 'gv' ? '（分子为国证成长口径）' : ''),
      '风格收益差' + key);
    container.appendChild(card);
    var chart = echarts.init(card.querySelector('.card-body'));
    var opt = baseLineOption('%');
    opt.grid.right = 56;
    opt.yAxis = [
      { type: 'value', scale: true, name: '收益差',
        axisLabel: { color: '#6b7280', fontSize: 11, formatter: function (v) { return (v * 100).toFixed(0) + '%'; } },
        splitLine: { lineStyle: { color: '#eef1f6' } } },
      { type: 'value', scale: true, name: '比价', position: 'right',
        axisLabel: { color: '#94a3b8', fontSize: 11 }, splitLine: { show: false } }
    ];
    opt.legend = { top: 2, icon: 'roundRect', itemWidth: 12, itemHeight: 3,
      textStyle: { fontSize: 11, color: '#4b5563' } };
    opt.tooltip = { trigger: 'axis', axisPointer: { type: 'cross' },
      backgroundColor: 'rgba(255,255,255,.96)', borderColor: '#e5e8ef',
      textStyle: { color: '#1f2430', fontSize: 12 } };
    opt.series = [
      { name: '40日收益差（左轴）', type: 'line', showSymbol: false,
        lineStyle: { width: 1.6, color: '#2563eb' }, itemStyle: { color: '#2563eb' },
        emphasis: { focus: 'series' },
        data: pairDates(dates, diff),
        markLine: { silent: true, symbol: 'none',
          data: [
            { yAxis: 0.1, lineStyle: { width: 1, color: '#b9c0cc', type: 'dashed' },
              label: { formatter: '±10%', fontSize: 10, color: '#9ca3af', position: 'insideEndTop' } },
            { yAxis: -0.1, lineStyle: { width: 1, color: '#b9c0cc', type: 'dashed' }, label: { show: false } },
            { yAxis: 0.2, lineStyle: { width: 1, color: '#9ca3af', type: 'dashed' },
              label: { formatter: '±20%', fontSize: 10, color: '#6b7280', position: 'insideEndTop' } },
            { yAxis: -0.2, lineStyle: { width: 1, color: '#9ca3af', type: 'dashed' }, label: { show: false } },
            { yAxis: 0, lineStyle: { width: 1, color: '#d5dae3' }, label: { show: false } }
          ] } },
      { name: P.a_name + '/' + P.b_name + '（右轴）', type: 'line', showSymbol: false, yAxisIndex: 1,
        lineStyle: { width: 1.4, color: '#dc2626' }, itemStyle: { color: '#dc2626' },
        emphasis: { focus: 'series' }, data: pairDates(dates, ratio) }
    ];
    chart.setOption(opt);
    charts.push(chart);
    addZoomHover(card, chart);
    registerCard(card, chart, '风格收益差 ' + P.title + ' ' + P.a_name + ' ' + P.b_name + ' 再平衡');
  }

  function crowdingMethodCard(container) {
    if (!D.sentiment.crowding_method) return;
    var card = makeCard('拥挤度方法论（七因子体系）', '', '2026-09', true, null, '拥挤度方法论');
    var body = card.querySelector('.card-body');
    body.style.height = 'auto';
    body.style.padding = '6px 16px 14px';
    body.style.fontSize = '12px';
    body.style.lineHeight = '1.8';
    body.style.color = 'var(--text-sub)';
    body.textContent = D.sentiment.crowding_method;
    container.appendChild(card);
    registerCard(card, null, '拥挤度 方法论 成交额分位 换手率 均线 新高 融资 主力 研报');
  }

  /* ---------------- 国内宏观（库 + 框架） ---------------- */
  function mcSeries(name) {
    var s = (D.macro_cn.series || []).filter(function (x) { return x.name === name; })[0];
    return s ? s.values : null;
  }

  function mcLine(container, title, names, colors, unit, note, key, bars) {
    var dates = D.macro_cn.dates;
    var arr = [];
    names.forEach(function (n, i) {
      var v = mcSeries(n);
      if (v) arr.push({ name: n, values: v, color: colors ? colors[i] : null, bar: bars && bars.indexOf(n) >= 0 });
    });
    if (!arr.length) return;
    var dateEnd = '';
    for (var i = dates.length - 1; i >= 0; i--) {
      var has = arr.some(function (s) { return s.values[i] != null; });
      if (has) { dateEnd = dates[i]; break; }
    }
    var card = makeCard(title, unit, dateEnd, true, note, key);
    container.appendChild(card);
    var chart = echarts.init(card.querySelector('.card-body'));
    var opt = baseLineOption(unit);
    opt.series = arr.map(function (s) {
      return { name: s.name, type: s.bar ? 'bar' : 'line', showSymbol: false,
        lineStyle: { width: 1.6 }, barMaxWidth: 8,
        emphasis: { focus: 'series' },
        data: pairDates(dates, s.values) };
    });
    chart.setOption(opt);
    charts.push(chart);
    addZoomHover(card, chart);
    registerCard(card, chart, key + ' ' + names.join(' '));
  }

  function macroJudgeCard(container) {
    var card = makeCard('宏观框架与当前读数（六角度 × 高频）', '', '2026-08', true, null, '宏观判断卡');
    var body = card.querySelector('.card-body');
    body.style.height = 'auto';
    body.style.padding = '6px 16px 14px';
    body.style.fontSize = '12.5px';
    body.style.lineHeight = '1.9';
    body.style.color = 'var(--text-sub)';
    body.innerHTML =
      '<b style="color:var(--text-main);">框架</b>（六角度框架）：'
      + '① 宏观看金融——企业存款与居民存款增速差为经济循环最领先指标，存款活化→非银存款→A股交易量的拔估值叙事；'
      + '② 政策看触发条件——出口赚钱+中美缓和窗口下"大招"概率低、兜底政策可期；'
      + '③ 中观看行业——中游制造（需求+供需均衡双优）相对占优、消费或已见底（供给出清）；'
      + '④ K型——人均GDP处V形底、分化是基础假设，收敛三条路径（制造业收入→消费 / 税收→财政 / 利润→投资）当前均不畅。'
      + '<br><b style="color:var(--text-main);">当前读数</b>（月度 2026-08 + 高频 0918）：'
      + '生产与出口偏强（工业+5.2%、出口约+25%、高技术+16.7%），内需偏弱（社零+0.4%、投资-7.2%、地产投资-19.9%）；'
      + 'PPI 6月+4.1%见顶后回落至+3.8%（中性情景兑现），CPI 0.8%；'
      + '金融端 M1 4.1%回升中、居民中长贷单月-822亿（居民缩表延续）、企业中长贷3200亿；'
      + '就业16-24岁17.6%高位（K型压力）。高频（0918）：油价压制生产、地产线级分化（一线强二三线弱）、就业K型延续。'
      + '<br><b style="color:var(--text-main);">反向声音</b>：K型分化是"常量"而非"变量"，AI/出口向上与私人部门/地产向下的两端平衡，'
      + '真正决定经济方向的是<b>财政节奏</b>（广义财政支出增速）——对应本页政府债与基建投资观察。'
      + '<br><b style="color:var(--text-main);">口径</b>：月度数据截至2026-08，周度高频截至2026-09-18。';
    container.appendChild(card);
    registerCard(card, null, '宏观判断 K型 分化 出口 PPI 领先指标 存款活化');
  }

  function renderMacroCn(container) {
    renderToolbar(container);
    var h0 = document.createElement('div');
    h0.className = 'section-title';
    h0.textContent = '框架与判断';
    container.appendChild(h0);
    macroJudgeCard(container);

    var h1 = document.createElement('div');
    h1.className = 'section-title';
    h1.textContent = '金融与领先指标（从金融指标看估值环境）';
    container.appendChild(h1);
    mcLine(container, '存款部门流转：住户/企业/非银新增存款12mma',
      ['住户新增存款12mma', '企业新增存款12mma', '非银新增存款12mma'], ['#dc2626', '#2563eb', '#d97706'], '亿元',
      '"最领先指标"原口径为住户/企业存款余额同比增速差（无月频分部门余额，以新增存款12mma稳健刻画同一逻辑）：'
      + '住户曲线自2024年高位持续回落+企业/非银抬升=居民存款活化（活化→非银→A股交易量的拔估值链条），已运行两年进入观察期。', 'M宏观领先');
    mcLine(container, 'M1与M2同比（剪刀差）',
      ['M1同比', 'M2同比'], ['#dc2626', '#2563eb'], '%',
      'M1-M2剪刀差反映资金活化程度；2025年以来M1回升=活化叙事的佐证，2026-08回落至4.1%需跟踪。', 'MM1M2');
    mcLine(container, '社融与信贷',
      ['社融存量同比', '社融存量同比(剔政府债)', '贷款余额同比'], ['#dc2626', '#d97706', '#2563eb'], '%',
      '剔除政府债的社融更能反映实体自发性信用扩张（财政扩张不足→企业无法有效扩信用）。', 'M社融');
    mcLine(container, '居民存款活化占比（住户新增存款/三项12mma）',
      ['居民存款活化占比(住户/三项12mma)'], ['#7c3aed'], '%',
      '新增居民存款占新增M2比值已回到疫情前=居民存款活化叙事到观察期（对应市场拔估值逻辑的阶段性尾部）。', 'M存款活化');
    mcLine(container, '企业与居民中长期贷款（当月新增）',
      ['企业中长贷当月新增', '居民中长贷当月新增'], ['#dc2626', '#2563eb'], '亿元',
      '居民中长贷持续低迷=居民缩表；企业中长贷反映资本开支意愿。柱状。', 'M中长贷', ['企业中长贷当月新增', '居民中长贷当月新增']);

    var h2 = document.createElement('div');
    h2.className = 'section-title';
    h2.textContent = '增长与生产';
    container.appendChild(h2);
    mcLine(container, '工业增加值与服务生产指数',
      ['工业增加值当月同比', '服务业生产指数当月同比', '工业增加值:高技术产业'], ['#2563eb', '#16a34a', '#dc2626'], '%',
      '高技术产业（新经济代表）与传统工业的增速裂口=新旧动能转换强度。', 'M生产');
    mcLine(container, '出口金额当月同比（美元计）',
      ['出口金额当月同比'], ['#dc2626'], '%',
      '出口赚钱（海外毛利率>国内）降低"大招"刺激概率；出口偏强是2026年宏观主线。', 'M出口');
    mcLine(container, 'GDP当季同比与三驾马车拉动',
      ['GDP当季同比', 'GDP拉动:消费', 'GDP拉动:投资', 'GDP拉动:净出口'], ['#1f2430', '#dc2626', '#2563eb', '#16a34a'], '%',
      '季度频率。净出口拉动为正=外需接力内需。', 'MGDP');

    var h3 = document.createElement('div');
    h3.className = 'section-title';
    h3.textContent = '消费（K型分化观察）';
    container.appendChild(h3);
    mcLine(container, '社零整体 vs 限额以上（K型：大众 vs 大企业）',
      ['社零当月同比', '限额以上零售当月同比'], ['#2563eb', '#dc2626'], '%',
      '限额以上（大企业/品牌集中）弱于整体=大众消费相对占优；反之=消费向头部集中。K型框架的消费视角。', 'M社零');

    var h4 = document.createElement('div');
    h4.className = 'section-title';
    h4.textContent = '投资';
    container.appendChild(h4);
    mcLine(container, '固定资产投资分项（累计同比）',
      ['制造业投资累计同比', '基础设施投资累计同比(含电力)', '房地产投资累计同比', '民间投资累计同比'],
      ['#2563eb', '#d97706', '#dc2626', '#7c3aed'], '%',
      '投资紧约束已从资金端转向项目端（施工项目计划总投资-4.3%）；中游制造固投占比仅12.5%。', 'M投资');

    var h5 = document.createElement('div');
    h5.className = 'section-title';
    h5.textContent = '物价（PPI情景）';
    container.appendChild(h5);
    mcLine(container, 'CPI与PPI当月同比',
      ['CPI当月同比', 'PPI当月同比'], ['#dc2626', '#2563eb'], '%',
      'PPI 2026-02转正后于6月+4.1%见顶、8月回落至+3.8%——中性情景（油价70美元假设）兑现；'
      + '反内卷+中游涨价是PPI回升主因，PPI回正利好上游资源与中游利润率。', 'IPPI');

    var h6 = document.createElement('div');
    h6.className = 'section-title';
    h6.textContent = '地产（线级分化）';
    container.appendChild(h6);
    mcLine(container, '地产销售与新开工（累计同比）',
      ['商品房销售面积同比', '商品房销售额同比', '房屋新开工同比', '土地购置面积同比'],
      ['#2563eb', '#0891b2', '#d97706', '#dc2626'], '%',
      '高频（0913）：一线二手带看连周回暖、一线挂牌量6.4%分位 vs 二线70.9%分位——线级分化扩大，一线供需预期偏积极、二三线价格回落。', 'M地产');

    var h7 = document.createElement('div');
    h7.className = 'section-title';
    h7.textContent = '就业（K型压力）';
    container.appendChild(h7);
    mcLine(container, '调查失业率：整体 vs 青年',
      ['城镇调查失业率', '31城调查失业率', '16-24岁失业率(不含在校生)'], ['#2563eb', '#94a3b8', '#dc2626'], '%',
      '青年失业率高位=K型分化压力的就业映射（灵活就业多→劳动力议价力下降→收入分化）。', 'M就业');
  }

  /* ---------------- 资金面（ +  + ） ---------------- */
  function renderLiquidity(container) {
    var L = D.liquidity;
    if (!L) return;
    renderToolbar(container);

    // 框架卡
    var card0 = makeCard('资金面框架与当前读数', '', L.position.asof, true, null, '资金面框架卡');
    var b0 = card0.querySelector('.card-body');
    b0.style.height = 'auto';
    b0.style.padding = '6px 16px 14px';
    b0.style.fontSize = '12.5px';
    b0.style.lineHeight = '1.9';
    b0.style.color = 'var(--text-sub)';
    var posLast = L.position.series['A股总仓位'];
    var posLastV = posLast ? posLast[posLast.length - 1] : null;
    var posPrev = posLast && posLast.length > 4 ? posLast[posLast.length - 5] : null;
    b0.innerHTML =
      '<b style="color:var(--text-main);">框架</b>（五维资金面跟踪）：'
      + '私募仓位/新备案（周度：主观仓位+量化收益+备案数量）+ 两融（日度：余额+买入额）'
      + '+ ETF 资金流（ 周频：全市场股票型 ETF 净流入）+ 国家队/汇金（周报跟踪：汇金系 ETF 周净流入）'
      + '+ 增量资金（公募新发/保险保费/存款搬家，月频）。'
      + '<br><b style="color:var(--text-main);">当前读数</b>：'
      + '主观私募A股仓位 <b style="color:var(--red);">' + (posLastV ? posLastV.toFixed(1) + '%' : '-') + '</b>'
      + '（4周' + (posPrev ? (posLastV - posPrev >= 0 ? '+' : '') + (posLastV - posPrev).toFixed(1) + 'pt' : '-') + '）；'
      + '两融余额 ' + (L.margin.bal[L.margin.bal.length - 1] / 10000).toFixed(2) + ' 万亿'
      + '（' + L.margin.bal_dates[L.margin.bal_dates.length - 1] + '）；维保比例 ' + L.margin.weibao.value + '%（偏热）；'
      + '本周 ETF 净流入 ' + L.etf.week_flow[L.etf.week_flow.length - 1] + ' 亿'
      + '（' + L.etf.week_dates[L.etf.week_dates.length - 1] + '周）；'
      + '科技硬件公募持仓 50%（超历史抱团峰值），存量筹码消化需1-3年（周报 0914）。'
      + '<br><b style="color:var(--text-main);">口径</b>：私募仓位为周频数据，'
      + '更新频率：私募周度、两融日度、ETF 周度。';
    container.appendChild(card0);
    registerCard(card0, null, '资金面 私募 两融 ETF 汇金 增量资金');

    var h1 = document.createElement('div');
    h1.className = 'section-title';
    h1.textContent = '私募仓位与风格（周频）';
    container.appendChild(h1);

    // 私募主观总仓位（多线）
    var posCard = makeCard('主观私募仓位走势（A股/港股/美股/总股票）', '%', L.position.asof, true,
      'A股仓位 ' + posLastV.toFixed(1) + '%，'
      + '2020年以来分位约63%（近两周小幅抬升）。', 'L主观仓位');
    container.appendChild(posCard);
    var posChart = echarts.init(posCard.querySelector('.card-body'));
    var posOpt = baseLineOption('%');
    posOpt.series = ['A股总仓位', '港股', '总股票仓位'].map(function (n) {
      var v = L.position.series[n];
      if (!v) return null;
      return { name: n, type: 'line', showSymbol: false, lineStyle: { width: 1.6 },
        emphasis: { focus: 'series' }, data: pairDates(L.position.dates, v) };
    }).filter(Boolean);
    posChart.setOption(posOpt);
    charts.push(posChart);
    addZoomHover(posCard, posChart);
    registerCard(posCard, posChart, '主观仓位 A股 港股 私募');

    // 主观风格拆分（沪深300/中证500/1000/2000/微盘/红利/双创）
    var styleCard = makeCard('主观私募风格持仓拆分（大盘/小盘/微盘/红利/双创）', '%', L.position.asof, true,
      '当前主观私募在小盘/微盘风格上的敞口变化。', 'L主观风格');
    container.appendChild(styleCard);
    var styleChart = echarts.init(styleCard.querySelector('.card-body'));
    var stOpt = baseLineOption('%');
    stOpt.series = ['沪深300', '中证1000', '中证2000', '微盘股', '风格:红利', '风格:双创'].map(function (n) {
      var v = L.position.series[n];
      if (!v) return null;
      return { name: n, type: 'line', showSymbol: false, lineStyle: { width: 1.4 },
        emphasis: { focus: 'series' }, data: pairDates(L.position.dates, v) };
    }).filter(Boolean);
    styleChart.setOption(stOpt);
    charts.push(styleChart);
    addZoomHover(styleCard, styleChart);
    registerCard(styleCard, styleChart, '主观风格 大盘 小盘 微盘 红利 双创');

    // 私募新备案（量化+主观周度）
    var beianCard = makeCard('私募新备案数量（量化 vs 主观 · 周频）', '只', '2026-09-18', true,
      '量化新备案 ' + L.beian.quant_total[L.beian.quant_total.length - 1]
      + ' 只、主观 ' + L.beian.subj_total[L.beian.subj_total.length - 1] + ' 只（本周）。'
      + '新备案是增量资金的领先信号。', 'L新备案');
    container.appendChild(beianCard);
    var beianChart = echarts.init(beianCard.querySelector('.card-body'));
    var bOpt = baseLineOption('只');
    // 周度数据太密（613条），用月度聚合
    var qM = {}, sM = {};
    L.beian.quant_total.forEach(function (v, i) {
      // dates 不在手边，用索引推算近似——改用直接截取近100周
    });
    // 简化：取最近100周
    var recentN = Math.min(100, L.beian.quant_total.length, L.beian.subj_total.length);
    var qRecent = L.beian.quant_total.slice(-recentN);
    var sRecent = L.beian.subj_total.slice(-recentN);
    var bDates = L.position.dates.slice(-recentN); // 近似日期
    bOpt.series = [
      { name: '量化新备案', type: 'bar', barMaxWidth: 6, data: pairDates(bDates, qRecent),
        itemStyle: { color: '#2563eb' } },
      { name: '主观新备案', type: 'bar', barMaxWidth: 6, data: pairDates(bDates, sRecent),
        itemStyle: { color: '#dc2626' } }
    ];
    beianChart.setOption(bOpt);
    charts.push(beianChart);
    addZoomHover(beianCard, beianChart);
    registerCard(beianCard, beianChart, '新备案 量化 主观 私募');

    var h2 = document.createElement('div');
    h2.className = 'section-title';
    h2.textContent = '两融与杠杆资金（日频）';
    container.appendChild(h2);

    // 两融余额
    var mCard = makeCard('沪深两市融资余额（万亿元）', '亿', L.margin.bal_dates[L.margin.bal_dates.length - 1], true,
      '较 2026-06-25 高点 3.00 万亿去化约 -1,300 亿。融资余额是杠杆资金的存量指标。', 'L两融余额');
    container.appendChild(mCard);
    var mChart = echarts.init(mCard.querySelector('.card-body'));
    var mOpt = baseLineOption('亿');
    mOpt.series = [{ name: '融资余额', type: 'line', showSymbol: false,
      lineStyle: { width: 1.6, color: '#dc2626' }, itemStyle: { color: '#dc2626' },
      emphasis: { focus: 'series' }, data: pairDates(L.margin.bal_dates, L.margin.bal) }];
    mChart.setOption(mOpt);
    charts.push(mChart);
    addZoomHover(mCard, mChart);
    registerCard(mCard, mChart, '两融 融资余额 杠杆');

    // 30日两融余额增量 vs 全A / TMT（双轴，两图并排——.grid 本身为2列）
    var mi = L.margin_incr;
    if (mi && mi.dates) {
      var miLast = mi.dates[mi.dates.length - 1];
      [
        { title: '30日两融余额增量 与 全A收盘价', sub: '全A', vals: mi.alla, cid: 'L两融增量全A' },
        { title: '30日两融余额增量 与 TMT收盘价', sub: '中证TMT', vals: mi.tmt, cid: 'L两融增量TMT' }
      ].forEach(function (cfg) {
        var card = makeCard(cfg.title, '亿元', miLast, false,
          '30日两融余额增量（蓝，左轴，亿元）= 两融余额 − 30个交易日前余额，刻画杠杆资金的月度净流入强度。'
          + cfg.sub + '收盘价（橙，右轴）叠加对比，观察增量拐点与指数走势的领先/滞后关系。', cfg.cid);
        container.appendChild(card);
        var ch = echarts.init(card.querySelector('.card-body'));
        var o = {
          grid: { left: 58, right: 58, top: 34, bottom: 52 },
          legend: { top: 2, icon: 'roundRect', itemWidth: 12, itemHeight: 3, textStyle: { fontSize: 11, color: '#4b5563' } },
          tooltip: { trigger: 'axis', axisPointer: { type: 'cross' },
            backgroundColor: 'rgba(255,255,255,.96)', borderColor: '#e5e8ef',
            textStyle: { color: '#1f2430', fontSize: 12 } },
          xAxis: { type: 'category', data: mi.dates,
            axisLabel: { color: '#6b7280', fontSize: 10 }, axisLine: { lineStyle: { color: '#d5dae3' } } },
          yAxis: [
            { type: 'value', name: '增量', nameTextStyle: { fontSize: 10, color: '#6b7280' },
              axisLabel: { color: '#6b7280', fontSize: 10 }, splitLine: { lineStyle: { color: '#eef1f6' } } },
            { type: 'value', name: '收盘', position: 'right', scale: true, nameTextStyle: { fontSize: 10, color: '#d97706' },
              axisLabel: { color: '#d97706', fontSize: 10 }, splitLine: { show: false } }
          ],
          series: [
            { name: '30日两融余额增量', type: 'line', showSymbol: false, lineStyle: { width: 1.5, color: '#2563eb' },
              itemStyle: { color: '#2563eb' }, emphasis: { focus: 'series' },
              data: mi.incr30,
              markLine: { silent: true, symbol: 'none', lineStyle: { color: '#c3c9d4', width: 1 },
                data: [{ yAxis: 0, label: { show: false } }] } },
            { name: cfg.sub + '收盘价', type: 'line', showSymbol: false, yAxisIndex: 1,
              lineStyle: { width: 1.5, color: '#d97706' }, itemStyle: { color: '#d97706' },
              emphasis: { focus: 'series' }, data: cfg.vals }
          ]
        };
        ch.setOption(o);
        charts.push(ch);
        addZoomHover(card, ch);
        registerCard(card, ch, '两融 30日增量 ' + cfg.sub + ' 杠杆资金 收盘价');
      });
    }

    var h3 = document.createElement('div');
    h3.className = 'section-title';
    h3.textContent = 'ETF 资金流（ · 周频）';
    container.appendChild(h3);

    // ETF 周度净流入（柱+累计线双轴）
    var eCard = makeCard('全市场股票型 ETF 周度净流入与累计', '亿', L.etf.week_dates[L.etf.week_dates.length - 1], true,
      '2026-01 单周净流出超 -3,300 亿（大额赎回），7-8 月转为净流入修复。'
      + 'ETF 是本轮最重要的边际买盘之一。来源。', 'LETF资金流');
    container.appendChild(eCard);
    var eChart = echarts.init(eCard.querySelector('.card-body'));
    var eOpt = baseLineOption('亿');
    eOpt.grid.right = 56;
    eOpt.yAxis = [
      { type: 'value', name: '周净流入', axisLabel: { color: '#6b7280', fontSize: 11 },
        splitLine: { lineStyle: { color: '#eef1f6' } } },
      { type: 'value', name: '累计', position: 'right',
        axisLabel: { color: '#94a3b8', fontSize: 11 }, splitLine: { show: false } }
    ];
    eOpt.series = [
      { name: '周净流入', type: 'bar', barMaxWidth: 8,
        data: pairDates(L.etf.week_dates, L.etf.week_flow),
        itemStyle: { color: '#2563eb' } },
      { name: '累计（右轴）', type: 'line', yAxisIndex: 1, showSymbol: false,
        lineStyle: { width: 1.8, color: '#dc2626' }, itemStyle: { color: '#dc2626' },
        data: pairDates(L.etf.week_dates, L.etf.week_cum) }
    ];
    eChart.setOption(eOpt);
    charts.push(eChart);
    addZoomHover(eCard, eChart);
    registerCard(eCard, eChart, 'ETF 资金流 净流入 累计');

    // 汇金系 ETF 周度净流入（国家队动向）
    var hjw = L.huijin_weekly;
    if (hjw && hjw.weeks && hjw.weeks.length) {
      var hj = D.hf_macro ? D.hf_macro.huijin : null;
      var hjCard = makeCard('汇金系 ETF 周度净流入（23只 · 国家队动向）', '亿元', hjw.asof, true,
        '汇金/中央汇金系 23 只宽基 ETF 的周度净流入（红柱=净申购、绿柱=净赎回），'
        + '深色线为区间累计净流入（右轴）。用于观察国家队入场的节奏与方向。'
        + '历史规律：单周净流入突然放大（百亿级）多对应指数阶段性底部区域。', '汇金ETF周度');
      container.appendChild(hjCard);
      var hjChart = echarts.init(hjCard.querySelector('.card-body'));
      var hjOpt = {
        grid: { left: 62, right: 66, top: 34, bottom: 54 },
        legend: { top: 2, icon: 'roundRect', itemWidth: 12, itemHeight: 3, textStyle: { fontSize: 11, color: '#4b5563' } },
        tooltip: { trigger: 'axis', axisPointer: { type: 'cross' },
          backgroundColor: 'rgba(255,255,255,.96)', borderColor: '#e5e8ef',
          textStyle: { color: '#1f2430', fontSize: 12 } },
        xAxis: { type: 'category', data: hjw.weeks,
          axisLabel: { color: '#6b7280', fontSize: 10, rotate: 45 }, axisLine: { lineStyle: { color: '#d5dae3' } } },
        yAxis: [
          { type: 'value', name: '周净流入', nameTextStyle: { fontSize: 10, color: '#6b7280' },
            axisLabel: { color: '#6b7280', fontSize: 10 }, splitLine: { lineStyle: { color: '#eef1f6' } } },
          { type: 'value', name: '累计', position: 'right', nameTextStyle: { fontSize: 10, color: '#334155' },
            axisLabel: { color: '#334155', fontSize: 10 }, splitLine: { show: false } }
        ],
        series: [
          { name: '周净流入', type: 'bar', barMaxWidth: 22, data: hjw.weekly,
            itemStyle: { borderRadius: [3, 3, 0, 0], color: function (p) { return p.value >= 0 ? '#dc2626' : '#16a34a'; } } },
          { name: '累计净流入（右轴）', type: 'line', showSymbol: false, yAxisIndex: 1,
            lineStyle: { width: 1.8, color: '#334155' }, itemStyle: { color: '#334155' },
            emphasis: { focus: 'series' }, data: hjw.cum,
            markLine: { silent: true, symbol: 'none', lineStyle: { color: '#c3c9d4', width: 1 },
              data: [{ yAxis: 0, label: { show: false } }] } }
        ]
      };
      hjChart.setOption(hjOpt);
      charts.push(hjChart);
      addZoomHover(hjCard, hjChart);
      registerCard(hjCard, hjChart, '汇金 ETF 国家队 周度 净流入 沪深300 中证500 中证1000');

      // 分组卡片（表格式）
      var grp = hjw.groups || {};
      var gKeys = Object.keys(grp).sort(function (a, b) { return grp[b].week - grp[a].week; });
      var gCard = makeCard('汇金系 ETF 分组净流入（7组 · 本周）', '亿元', hjw.asof, true,
        '按跟踪指数分组：本周净流入（红=流入、绿=流出）与区间累计。'
        + '沪深300系是历次托底的主信号，中证500/1000系反映对中小盘的承接力度。', '汇金ETF分组');
      var gBody = gCard.querySelector('.card-body');
      gBody.style.height = 'auto';
      gBody.style.padding = '4px 16px 12px';
      var gHtml = '<table style="width:100%;border-collapse:collapse;font-size:12px;">'
        + '<tr style="color:var(--text-faint);font-size:11px;">'
        + '<td style="padding:5px 4px;">分组</td><td style="padding:5px 4px;text-align:right;">只数</td>'
        + '<td style="padding:5px 4px;text-align:right;">本周净流入</td>'
        + '<td style="padding:5px 4px;text-align:right;">区间累计</td></tr>';
      gKeys.forEach(function (k) {
        var v = grp[k];
        var cw = v.week >= 0 ? 'var(--red)' : 'var(--green)';
        var cc = v.cum >= 0 ? 'var(--red)' : 'var(--green)';
        gHtml += '<tr style="border-top:1px solid var(--border);">'
          + '<td style="padding:5px 4px;">' + k + '</td>'
          + '<td style="padding:5px 4px;text-align:right;color:var(--text-sub);">' + v.n + '</td>'
          + '<td style="padding:5px 4px;text-align:right;color:' + cw + ';font-weight:600;">' + (v.week >= 0 ? '+' : '') + v.week.toFixed(2) + '</td>'
          + '<td style="padding:5px 4px;text-align:right;color:' + cc + ';">' + (v.cum >= 0 ? '+' : '') + v.cum.toFixed(2) + '</td></tr>';
      });
      gHtml += '</table>';
      if (hj && hj.groups) {
        gHtml += '<div style="margin-top:8px;font-size:11.5px;color:var(--text-faint);line-height:1.8;">'
          + '成分：' + Object.keys(hj.groups).map(function (g) { return g + '(' + hj.groups[g].length + ')'; }).join('、')
          + '</div>';
      }
      gBody.innerHTML = gHtml;
      container.appendChild(gCard);
      registerCard(gCard, null, '汇金 分组 沪深300 上证50 中证500 中证1000 创业板 科创50');
    }
  }

  /* ---------------- 海外宏观（美债分解框架） ---------------- */
  function mgLine(container, title, names, dates, unit, note, key) {
    var arr = [];
    var data = D.macro_global;
    names.forEach(function (n) {
      var v = null;
      if (data.cds[n]) v = data.cds[n];
      else if (data[n]) v = data[n].values || data[n];
      if (!v) return;
      arr.push({ name: n, values: v });
    });
    if (!arr.length) return;
    var d = dates || data.cds.dates;
    var dateEnd = d[d.length - 1];
    var card = makeCard(title, unit, dateEnd, true, note, key);
    container.appendChild(card);
    var chart = echarts.init(card.querySelector('.card-body'));
    var opt = baseLineOption(unit);
    opt.series = arr.map(function (s) {
      return { name: s.name, type: 'line', showSymbol: false,
        lineStyle: { width: 1.5 }, emphasis: { focus: 'series' },
        data: pairDates(d, s.values) };
    });
    chart.setOption(opt);
    charts.push(chart);
    addZoomHover(card, chart);
    registerCard(card, chart, key + ' ' + names.join(' '));
  }

  function fedwatchTable(container) {
    var fw = D.macro_global.fedwatch;
    if (!fw) return;
    var card = makeCard('利率期货隐含加息概率矩阵（条件会议概率 %）', '', '2026-09-19', true,
      fw.note + '。', '利率期货');
    var body = card.querySelector('.card-body');
    body.style.height = 'auto';
    body.style.padding = '6px 12px 12px';
    body.style.overflowX = 'auto';
    var html = '<table style="border-collapse:collapse;width:100%;font-size:11px;font-variant-numeric:tabular-nums;">';
    html += '<thead><tr><th style="padding:4px 6px;border:1px solid #e5e8ef;background:#f6f8fc;text-align:left;position:sticky;left:0;">Meeting</th>';
    fw.ranges.forEach(function (r) {
      html += '<th style="padding:4px 6px;border:1px solid #e5e8ef;background:#f6f8fc;">' + r + '</th>';
    });
    html += '</tr></thead><tbody>';
    fw.matrix.forEach(function (row, ri) {
      var maxV = Math.max.apply(null, row.filter(function (v) { return v != null && v > 0; }));
      html += '<tr><td style="padding:4px 6px;border:1px solid #e5e8ef;font-weight:600;white-space:nowrap;position:sticky;left:0;background:#fff;">' + fw.meetings[ri] + '</td>';
      row.forEach(function (v, ci) {
        if (v == null) { html += '<td style="padding:4px 6px;border:1px solid #e5e8ef;color:#c3c9d4;text-align:center;">-</td>'; return; }
        // 颜色：越浅蓝=概率越高（模拟原版配色）
        var bg = 'transparent';
        if (v >= 40) bg = '#a8d8ea';
        else if (v >= 20) bg = '#c5e8f0';
        else if (v >= 10) bg = '#dceef5';
        else if (v >= 5) bg = '#eaf5f9';
        else if (v > 0) bg = '#f5fafc';
        var bold = v === maxV && v > 0;
        html += '<td style="padding:4px 6px;border:1px solid #e5e8ef;text-align:center;background:' + bg + ';'
          + (bold ? 'font-weight:700;color:#1e56b0;' : 'color:#6b7280;') + '">' + (v > 0 ? v.toFixed(1) : '0') + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    body.innerHTML = html;
    container.appendChild(card);
    registerCard(card, null, '利率期货 加息 概率 利率区间');
  }

  function macroGlobalJudgeCard(container) {
    var card = makeCard('美债分解框架与当前判断', '', '2026-09', true, null, '海外宏观判断卡');
    var body = card.querySelector('.card-body');
    body.style.height = 'auto';
    body.style.padding = '6px 16px 14px';
    body.style.fontSize = '12.5px';
    body.style.lineHeight = '1.9';
    body.style.color = 'var(--text-sub)';
    body.innerHTML =
      '<b style="color:var(--text-main);">10Y美债 = 政策利率预期（短端） + 期限溢价（长端）</b>'
      + '<br><b style="color:var(--red);">短端（政策利率路径）</b>：'
      + '① 利率期货定价：10/28 按兵不动57.6%，12/9 再加息25bp预期44.1%——市场定价一次加息后停止；'
      + '② 但周报判断（0914）：抗通胀式加息一旦开启极少只加一次（1990年来唯一例外是1997年3月25bp），'
      + '油价 WTI 从年初 $57 涨至 $100（美伊冲突+霍尔木兹压力），油价是核心变量；'
      + '③ 核心PCE：从2025年10月低点2.75%回升至2026年7月3.34%（连续6个月上行），通胀韧性支持联储鹰派；'
      + '④ 非农：2026年7月+21k（极弱），8月+162k（反弹）——就业数据信号混杂。'
      + '<br><b style="color:var(--blue,#2563eb);">长端（期限溢价）</b>：'
      + '① 财政赤字：2026年美国财政赤字持续扩大，长债供给压力上升（TBAC FY2027 长债发行转向）；'
      + '② AI债挤出：超大规模厂商Capex 2026E合计 $790B，AI企业债发行对长债投资需求形成挤压（约1/8~1/4久期挤出）；'
      + '③ 联储信用：沃什9月按兵不动维护信用，但若被迫连续加息将侵蚀可信度→期限溢价补偿上升；'
      + '④ 10Y美债月均：2026-07 达 4.66%（近期高点），期限溢价贡献为主。'
      + '<br><b style="color:var(--text-main);">核心结论</b>：短端看油价（>100美元=抗通胀加息压力），长端看财政赤字+AI债挤出+联储信用。'
      + '当前10Y 4.66%中，期限溢价贡献估计 1.5-2.0%（实际期限溢价是主驱动），剩余为加息预期定价。'
      + '风险：若油价持续>100，或AI债发行超预期，10Y可能测试 5.0%。';
    container.appendChild(card);
    registerCard(card, null, '海外宏观 美债 期限溢价 政策利率 赤字 AI债 沃什 油价');
  }

  function renderMacroGlobal(container) {
    renderToolbar(container);
    var h0 = document.createElement('div');
    h0.className = 'section-title';
    h0.textContent = '美债分解框架';
    container.appendChild(h0);
    macroGlobalJudgeCard(container);
    fedwatchTable(container);

    var h1 = document.createElement('div');
    h1.className = 'section-title';
    h1.textContent = '美联储决策核心数据';
    container.appendChild(h1);
    mgLine(container, '核心PCE当月同比（%）', ['core_pce'], null, '%',
      '从2025-10低点2.75%回升至2026-07的3.34%（连续上行），通胀韧性是联储鹰派的基础。'
      + '', 'MG_PCE');
    mgLine(container, '美国新增非农就业（千人）', ['nfp'], null, 'k',
      '2026年7月+21k极弱、8月+162k反弹——就业信号混杂。'
      + '', 'MG_NFP');

    var h3 = document.createElement('div');
    h3.className = 'section-title';
    h3.textContent = '油价与地缘';
    container.appendChild(h3);
    mgLine(container, 'WTI原油期货结算价（美元/桶）', ['wti'], null, '$',
      '2026-01低点 $55 → 4月 $105 → 6月回落至 $69 → 9月再度突破 $100（美伊冲突+霍尔木兹压力）。'
      + '油价>100美元=联储被迫抗通胀加息的核心催化。', 'MG_WTI');

    // 10Y美债月度
    var u10 = D.macro_global.ust10_monthly;
    if (u10 && u10.dates.length) {
      var uCard = makeCard('10Y美债收益率（月均值 %）', '%', u10.dates[u10.dates.length - 1], true,
        '2026-07月均 4.66%（近期高点）。月度频率，日度需  G002600774。', 'MG_10Y');
      container.appendChild(uCard);
      var uChart = echarts.init(uCard.querySelector('.card-body'));
      var uOpt = baseLineOption('%');
      uOpt.xAxis.type = 'category';
      uOpt.xAxis.data = u10.dates.map(function (d) { return d.slice(0, 7); });
      uOpt.series = [{ name: '10Y美债', type: 'line', showSymbol: false,
        lineStyle: { width: 1.8, color: '#2563eb' }, itemStyle: { color: '#2563eb' },
        emphasis: { focus: 'series' }, data: u10.values }];
      uChart.setOption(uOpt);
      charts.push(uChart);
      addZoomHover(uCard, uChart);
      registerCard(uCard, uChart, '10Y美债 国债收益率');
    }
  }

  /* ---------------- 综合打分 ---------------- */
  function renderScoring(container) {
    var SC = D.scoring;
    if (!SC || !SC.rows) return;
    renderToolbar(container);

    // 方法论卡
    var card0 = makeCard('五维打分框架与方法论', '', '2026-09', true, null, '打分方法论');
    var b0 = card0.querySelector('.card-body');
    b0.style.height = 'auto';
    b0.style.padding = '6px 16px 14px';
    b0.style.fontSize = '12.5px';
    b0.style.lineHeight = '1.9';
    b0.style.color = 'var(--text-sub)';
    b0.innerHTML = SC.methodology
      + '<br><b style="color:var(--text-main);">打分逻辑</b>：盈利分(胜率) 越高=景气越好；估值分(赔率) 越高=越便宜；情绪分 越高=越冷（逆向价值）；资金分 越高=越欠配（有加仓空间）；动量分 越高=短期越热。'
      + '<br><b style="color:var(--text-main);">估值指标选择</b>：上游周期、地产金融用<b>PB</b>（周期底部盈利波动大，PB代表安全边际）；'
      + '其他行业用<b>PE</b>（盈利相对稳定，PE反映市场定价）。当前：电子/通信估值分位>80%（偏贵）；建材/电力设备/食品饮料/银行/非银<30%（便宜）。'
      + '<br><b style="color:var(--text-main);">二阶导</b>：27E−26E增速差(百分点)。>0=盈利预期加速（"Δg>0"=产业趋势行情存续的核心）；'
      + '<0=增速见顶回落（领先股价拐点1-2季度）。A股的相对收益考核机制导致资金追逐边际改善最锐利的方向→二阶导转负=资金撤退信号。'
      + '<br><b style="color:var(--text-main);">胜率-赔率象限</b>：高胜率+高赔率=核心配置；低胜率+高赔率=左侧布局；'
      + '高胜率+低赔率=持有减仓；低胜率+低赔率=规避。当前阶段：先看胜率、再看赔率。';
    container.appendChild(card0);
    registerCard(card0, null, '打分方法论 PB-ROE PEG 二阶导 胜率 赔率');

    // 打分表
    var wrap = document.createElement('div');
    wrap.className = 'ov-table-wrap';
    var cols = [
      ['name', '行业', 'text'],
      ['composite', '综合分', 'score'],
      ['earn_score', '盈利分(胜率)', 'score'],
      ['val_score', '估值分(赔率)', 'score'],
      ['sent_score', '情绪分(逆向)', 'score'],
      ['fund_score', '资金分(欠配)', 'score'],
      ['mom_score', '动量分', 'score'],
      ['g26e', '26E增速%', 'pct'],
      ['g27e', '27E增速%', 'pct'],
      ['accel', '二阶导pp', 'pct'],
      ['pe', 'PE', 'num'],
      ['pe_pct', 'PE分位%', 'num'],
      ['pb', 'PB', 'num'],
      ['pb_pct', 'PB分位%', 'num'],
      ['roe', 'ROE%', 'num'],
      ['peg26', 'PEG', 'num'],
      ['fund_ov', '公募超配pp', 'pct'],
      ['sentiment', '情绪30日', 'num'],
    ];
    var html = '<table id="ov-table"><thead><tr>';
    cols.forEach(function (c) { html += '<th data-k="' + c[0] + '">' + c[1] + '</th>'; });
    html += '</tr></thead><tbody>';
    SC.rows.forEach(function (r) {
      html += '<tr><td>' + r.name + '</td>';
      cols.slice(1).forEach(function (c) {
        var v = r[c[0]];
        if (v == null) { html += '<td style="color:#c3c9d4;">-</td>'; return; }
        var cls = '';
        if (c[2] === 'score') {
          cls = v >= 70 ? 'pos' : (v <= 30 ? 'neg' : '');
        } else if (c[2] === 'pct') {
          cls = v >= 0 ? 'pos' : 'neg';
        } else if (['pe_pct', 'pb_pct', 'peg26'].indexOf(c[0]) >= 0) {
          cls = v > 80 ? 'pos' : (v < 20 ? 'neg' : '');
        }
        var txt = typeof v === 'number' ? (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1)) : v;
        html += '<td class="' + cls + '">' + txt + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    wrap.innerHTML = html;
    container.appendChild(wrap);
    // 排序
    var sortState = { key: 'composite', dir: -1 };
    wrap.querySelectorAll('th').forEach(function (th) {
      th.onclick = function () {
        var k = th.getAttribute('data-k');
        if (k === 'name') return;
        if (sortState.key === k) sortState.dir = -sortState.dir;
        else { sortState.key = k; sortState.dir = -1; }
        var rows = SC.rows.slice().sort(function (a, b) {
          var va = a[k], vb = b[k];
          if (va == null && vb == null) return 0;
          if (va == null) return 1;
          if (vb == null) return -1;
          return (va - vb) * sortState.dir;
        });
        // 重建tbody
        var tbody = wrap.querySelector('tbody');
        var html2 = '';
        rows.forEach(function (r) {
          html2 += '<tr><td>' + r.name + '</td>';
          cols.slice(1).forEach(function (c) {
            var v = r[c[0]];
            if (v == null) { html2 += '<td style="color:#c3c9d4;">-</td>'; return; }
            var cls = '';
            if (c[2] === 'score') { cls = v >= 70 ? 'pos' : (v <= 30 ? 'neg' : ''); }
            else if (c[2] === 'pct') { cls = v >= 0 ? 'pos' : 'neg'; }
            html2 += '<td class="' + cls + '">' + v + '</td>';
          });
          html2 += '</tr>';
        });
        tbody.innerHTML = html2;
      };
    });

    // PB-ROE 散点图
    var grid2 = document.createElement('div');
    grid2.className = 'grid';
    container.appendChild(grid2);
    var h2 = document.createElement('div');
    h2.className = 'section-title';
    h2.textContent = 'PB-ROE 散点（估值 vs 盈利能力）';
    grid2.appendChild(h2);
    var prCard = makeCard('PB-ROE：PB分位(x) × ROE-TTM(y)', '%', '2026-09', true,
      '左上=高ROE+低PB（最便宜，价值金矿）；右下=低ROE+高PB（最贵）。气泡大小=综合分。', 'PB-ROE散点');
    grid2.appendChild(prCard);
    var prChart = echarts.init(prCard.querySelector('.card-body'));
    var prData = SC.rows.map(function (r) {
      return { value: [r.pb_pct, r.roe], name: r.name,
        symbolSize: Math.max(8, r.composite / 4),
        itemStyle: { color: r.composite >= 65 ? '#dc2626' : (r.composite <= 50 ? '#16a34a' : '#2563eb') } };
    });
    prChart.setOption({
      grid: { left: 56, right: 30, top: 30, bottom: 50 },
      tooltip: { formatter: function (p) { return p.name + '<br>PB分位: ' + p.value[0] + '%<br>ROE: ' + p.value[1] + '%'; } },
      xAxis: { type: 'value', name: 'PB分位(%)', max: 100, min: 0,
        axisLabel: { color: '#6b7280', fontSize: 11 }, splitLine: { lineStyle: { color: '#eef1f6' } } },
      yAxis: { type: 'value', name: 'ROE-TTM(%)',
        axisLabel: { color: '#6b7280', fontSize: 11 }, splitLine: { lineStyle: { color: '#eef1f6' } } },
      series: [{ type: 'scatter', data: prData,
        label: { show: true, formatter: '{b}', fontSize: 9, color: '#374151', position: 'top' },
        emphasis: { scale: 1.3 },
        markLine: { silent: true, symbol: 'none',
          lineStyle: { color: '#c3c9d4', type: 'dashed' },
          data: [{ xAxis: 50, label: { formatter: 'PB分位50%', fontSize: 10, color: '#9ca3af' } },
                 { yAxis: 6, label: { formatter: 'ROE中位', fontSize: 10, color: '#9ca3af' } } ] } }]
    });
    charts.push(prChart);
    registerCard(prCard, prChart, 'PB-ROE 散点图 ' + SC.rows.map(function (r) { return r.name; }).join(' '));

    // 胜率-赔率象限
    var h3 = document.createElement('div');
    h3.className = 'section-title';
    h3.textContent = '胜率-赔率象限';
    grid2.appendChild(h3);
    var qlCard = makeCard('胜率(盈利分) × 赔率(估值分) 象限图', '', '2026-09', true,
      '右上=高胜率+高赔率（核心配置）；左上=低胜率+高赔率（左侧布局）；右下=高胜率+低赔率（持有减仓）；左下=低胜率+低赔率（规避）。', '胜率赔率象限');
    grid2.appendChild(qlCard);
    var qlChart = echarts.init(qlCard.querySelector('.card-body'));
    var qlData = SC.rows.map(function (r) {
      return { value: [r.earn_score, r.val_score], name: r.name,
        symbolSize: Math.max(8, r.composite / 4),
        itemStyle: { color: r.composite >= 65 ? '#dc2626' : (r.composite <= 50 ? '#16a34a' : '#2563eb') } };
    });
    qlChart.setOption({
      grid: { left: 56, right: 30, top: 30, bottom: 50 },
      tooltip: { formatter: function (p) { return p.name + '<br>胜率(盈利): ' + p.value[0] + '<br>赔率(估值): ' + p.value[1]; } },
      xAxis: { type: 'value', name: '胜率(盈利分)', min: 0, max: 100,
        axisLabel: { color: '#6b7280', fontSize: 11 }, splitLine: { lineStyle: { color: '#eef1f6' } } },
      yAxis: { type: 'value', name: '赔率(估值分)', min: 0, max: 100,
        axisLabel: { color: '#6b7280', fontSize: 11 }, splitLine: { lineStyle: { color: '#eef1f6' } } },
      series: [{ type: 'scatter', data: qlData,
        label: { show: true, formatter: '{b}', fontSize: 9, color: '#374151', position: 'top' },
        emphasis: { scale: 1.3 },
        markLine: { silent: true, symbol: 'none',
          lineStyle: { color: '#c3c9d4', type: 'dashed' },
          data: [{ xAxis: 50 }, { yAxis: 50 }],
          label: { show: true, formatter: '50', fontSize: 10, color: '#9ca3af' } } }]
    });
    charts.push(qlChart);
    registerCard(qlCard, qlChart, '胜率赔率象限 ' + SC.rows.map(function (r) { return r.name; }).join(' '));

    // PEG 四象限图（PE分位 x 26E增速）
    var h4 = document.createElement('div');
    h4.className = 'section-title';
    h4.textContent = 'PE-26E增速 象限（成长性价比）';
    grid2.appendChild(h4);
    var pegCard = makeCard('PE分位(x) × 26E增速(y) 四象限', '%', '2026-09-20', true,
      '左上=低PE分位+高增速（最佳，双击主升）；右下=高PE分位+低增速（M顶风险区，规避）。'
      + '增速高且PE未透支=双击主升细分；增速见顶回落而估值高=坚决规避。', 'PEG象限');
    grid2.appendChild(pegCard);
    var pegChart = echarts.init(pegCard.querySelector('.card-body'));
    var pegRows = SC.rows.filter(function (r) { return r.pe_pct != null && r.g26e != null; });
    // 用行业中位数做分界
    var pePctMed = pegRows.map(function (r) { return r.pe_pct; }).sort(function (a, b) { return a - b; })[Math.floor(pegRows.length / 2)];
    var gMed = pegRows.map(function (r) { return r.g26e; }).filter(function (v) { return v != null; }).sort(function (a, b) { return a - b; })[Math.floor(pegRows.length / 2)];
    var pegData = pegRows.map(function (r) {
      var isGood = r.pe_pct < pePctMed && r.g26e > gMed;
      return { value: [r.pe_pct, r.g26e], name: r.name,
        symbolSize: Math.max(8, r.composite / 4),
        itemStyle: { color: isGood ? '#16a34a' : (r.pe_pct > 80 && r.g26e < 10 ? '#dc2626' : '#2563eb') } };
    });
    pegChart.setOption({
      grid: { left: 56, right: 30, top: 30, bottom: 50 },
      tooltip: { formatter: function (p) { return p.name + '<br>PE分位: ' + p.value[0] + '%<br>26E增速: ' + p.value[1] + '%'; } },
      xAxis: { type: 'value', name: 'PE分位(%)', min: 0, max: 100,
        axisLabel: { color: '#6b7280', fontSize: 11 }, splitLine: { lineStyle: { color: '#eef1f6' } } },
      yAxis: { type: 'value', name: '26E增速(%)',
        axisLabel: { color: '#6b7280', fontSize: 11 }, splitLine: { lineStyle: { color: '#eef1f6' } } },
      series: [{ type: 'scatter', data: pegData,
        label: { show: true, formatter: '{b}', fontSize: 9, color: '#374151', position: 'top' },
        emphasis: { scale: 1.3 },
        markLine: { silent: true, symbol: 'none',
          lineStyle: { color: '#c3c9d4', type: 'dashed' },
          data: [{ xAxis: pePctMed, label: { formatter: '中位数', fontSize: 10, color: '#9ca3af' } },
                 { yAxis: gMed, label: { formatter: '中位数', fontSize: 10, color: '#9ca3af' } } ] } }]
    });
    charts.push(pegChart);
    registerCard(pegCard, pegChart, 'PE增速象限 ' + pegRows.map(function (r) { return r.name; }).join(' '));

    // PEG 排名（保留）
    var h5 = document.createElement('div');
    h5.className = 'section-title';
    h5.textContent = 'PEG 排名（成长性价比）';
    grid2.appendChild(h5);
    var pegCard = makeCard('PEG排名（PE-TTM÷(1+g26E)÷g26E×100，低=性价比高）', '', '2026-09-20', false,
      'PEG<1 = 成长股性价比高。注意：PE-TTM基数大时PEG偏高，成长行业需结合远期PE（26E/27E口径）判断。', 'PEG排名');
    grid2.appendChild(pegCard);
    var pegChart = echarts.init(pegCard.querySelector('.card-body'));
    var pegRows = SC.rows.filter(function (r) { return r.peg26 != null && r.peg26 > 0 && r.peg26 < 10; })
      .sort(function (a, b) { return a.peg26 - b.peg26; });
    pegChart.setOption({
      grid: { left: 80, right: 40, top: 16, bottom: 56 },
      tooltip: { formatter: function (p) { return p.name + '：PEG=' + p.value + (p.value < 1 ? '（<1 性价比高）' : ''); } },
      xAxis: { type: 'category', data: pegRows.map(function (r) { return r.name; }),
        axisLabel: { color: '#6b7280', fontSize: 10, rotate: 45 } },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: '#eef1f6' } } },
      series: [{ type: 'bar', barMaxWidth: 14,
        data: pegRows.map(function (r) {
          return { value: r.peg26,
            itemStyle: { color: r.peg26 < 1 ? '#16a34a' : (r.peg26 < 2 ? '#2563eb' : '#dc2626'),
                         borderRadius: [2, 2, 0, 0] } };
        }),
        markLine: { silent: true, symbol: 'none',
          lineStyle: { color: '#d97706', type: 'dashed' },
          data: [{ yAxis: 1 }], label: { formatter: 'PEG=1', fontSize: 10, color: '#d97706' } } }]
    });
    charts.push(pegChart);
    registerCard(pegCard, pegChart, 'PEG排名 ' + pegRows.map(function (r) { return r.name; }).join(' '));
  }

  /* ---------------- 周度高频跟踪（高频PPT数据） ---------------- */
  function renderHighFreq(container) {
    renderToolbar(container);
    var HF = D.hf_macro;

    // 高频摘要卡（20260920 底稿核心读数）
    var hfCard = makeCard('高频景气摘要（20260920）', '', '2026-09-18', true, null, '高频摘要');
    var hb = hfCard.querySelector('.card-body');
    hb.style.height = 'auto';
    hb.style.padding = '6px 16px 14px';
    hb.style.fontSize = '12.5px';
    hb.style.lineHeight = '1.9';
    hb.style.color = 'var(--text-sub)';
    hb.innerHTML =
      '<b style="color:var(--text-main);">核心读数（截至 09/18 当周）</b><br>'
      + '<b>行业读数</b>：<br>'
      + '· <b>出口</b>：SCFI 综合指数 3687.8（环比 +0.7%，同比 +155%），运价维持历史高位区<br>'
      + '· <b>制造</b>：高炉开工率 82.3%（同比 -1.8%），日均铁水 237.6 万吨；沿海八省日耗 217.9 万吨（9/17）<br>'
      + '· <b>商品消费</b>：乘用车 9 月前两周零售同比 -23.0%（8 月 -19.0%），整体偏弱；空调周销售额同比约 -20%<br>'
      + '· <b>文旅消费</b>：当日电影票房 3846 万元（9/18）<br>'
      + '· <b>地产</b>：二手房日度成交北京 354 / 深圳 312（9/17），一线成交活跃<br>'
      + '· <b>就业</b>：零工工价全国 24.0 元/小时（同比 -10.8%），用工量指数同比 +0.4%，K 型分化延续<br>'
      + '<b style="color:var(--text-main);">小结</b>：出口运价一枝独秀，生产平稳、消费偏弱，就业工资端仍承压。';
    container.appendChild(hfCard);
    registerCard(hfCard, null, '高频 景气 出口 消费 地产 制造 就业');

    var h1 = document.createElement('div');
    h1.className = 'section-title';
    h1.textContent = '高频时序指标';
    container.appendChild(h1);

    // SCFI 出口运价（用修正后的综合指数序列，850周）
    if (HF.scfi_summary) {
      var scfiS = HF.scfi_summary;
      var scfiCard = makeCard('SCFI 上海出口集装箱运价指数', '指数', scfiS.dates[scfiS.dates.length - 1], true,
        '领先出口1-2个月。最新 ' + num1(scfiS.values[scfiS.values.length - 1])
        + '（环比 ' + num1(scfiS.wow) + '%，同比 ' + num1(scfiS.yoy) + '%）。'
        + '运价维持历史高位区=出口链条景气延续。', 'HF_SCFI');
      container.appendChild(scfiCard);
      var scfiChart = echarts.init(scfiCard.querySelector('.card-body'));
      var scfiOpt = baseLineOption('指数');
      scfiOpt.series = [{ name: 'SCFI综合指数', type: 'line', showSymbol: false,
        lineStyle: { width: 1.5, color: '#2563eb' }, itemStyle: { color: '#2563eb' },
        emphasis: { focus: 'series' }, data: pairDates(scfiS.dates, scfiS.values) }];
      scfiChart.setOption(scfiOpt);
      charts.push(scfiChart);
      addZoomHover(scfiCard, scfiChart);
      registerCard(scfiCard, scfiChart, 'SCFI 出口运价 集装箱');
    }

    // 高频指标趋势图（从景气跟踪底稿逐指标提取的时序）
    var HFC = D.hf_charts || [];
    HFC.forEach(function (c) {
      var lastOf = function (s) {
        for (var i = s.values.length - 1; i >= 0; i--) if (s.values[i] != null) return s.values[i];
        return null;
      };
      var desc = c.series.map(function (s) {
        var v = lastOf(s);
        return s.name + ' ' + (v == null ? '-' : (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1)));
      }).join('；');
      var card = makeCard(c.title, c.unit, c.dates[c.dates.length - 1], false,
        c.title.replace(/（.*?）/g, '') + '的时间序列。最新：' + desc + '。'
        + '便于观察绝对水平与季节性（同比口径需对照去年同期）。', 'HF_' + c.id);
      container.appendChild(card);
      var chart = echarts.init(card.querySelector('.card-body'));
      var opt = baseLineOption(c.unit);
      opt.grid.right = 24;
      opt.legend = { top: 2, icon: 'roundRect', itemWidth: 12, itemHeight: 3,
        textStyle: { fontSize: 11, color: '#4b5563' } };
      opt.series = c.series.map(function (s) {
        return { name: s.name, type: 'line', showSymbol: false,
          lineStyle: { width: 1.4, color: s.color }, itemStyle: { color: s.color },
          emphasis: { focus: 'series' },
          data: pairDates(c.dates, s.values), connectNulls: true };
      });
      chart.setOption(opt);
      charts.push(chart);
      addZoomHover(card, chart);
      registerCard(card, chart, c.title + ' ' + c.series.map(function (s) { return s.name; }).join(' '));
    });

    // 高频表格：全部指标最新读数
    var tableCard = makeCard('高频指标一览表', '', '2026-09-18', true, null, '高频表');
    var tb = tableCard.querySelector('.card-body');
    tb.style.height = 'auto';
    tb.style.padding = '6px 16px 14px';
    var tableHtml = '<table style="width:100%;border-collapse:collapse;font-size:12px;">'
      + '<tr><th style="padding:4px 8px;border:1px solid var(--border);background:#f6f8fc;text-align:left;">类别</th>'
      + '<th style="padding:4px 8px;border:1px solid var(--border);background:#f6f8fc;">指标</th>'
      + '<th style="padding:4px 8px;border:1px solid var(--border);background:#f6f8fc;">最新读数</th>'
      + '<th style="padding:4px 8px;border:1px solid var(--border);background:#f6f8fc;">方向</th></tr>';
    var hfData = [
      ['出口', 'SCFI综合指数(周·9/18)', '3687.8 (环比+0.7%)', '<span style="color:var(--red);">↑ 同比+155%</span>'],
      ['制造', '高炉开工率(247家·9/18)', '82.3% (同比-1.8%)', '→ 平稳'],
      ['制造', '日均铁水产量(9/18)', '237.6 万吨', '→ 平稳'],
      ['制造', '沿海八省电厂日耗(9/17)', '217.9 万吨', '→ 旺季高位'],
      ['消费', '乘用车零售同比(9月至9/13)', '-23.0% (8月-19.0%)', '<span style="color:var(--green);">↓ 偏弱</span>'],
      ['消费', '空调周销售额同比(9/13周)', '约 -20%', '<span style="color:var(--green);">↓ 回落</span>'],
      ['消费', '当日电影票房(9/18)', '3846 万元', '→ 中性'],
      ['地产', '二手房日度成交 北京/深圳(9/17)', '354 / 312', '→ 一线活跃'],
      ['就业', '零工工价同比 全国(9/17)', '-10.8%', '<span style="color:var(--green);">↓ K型延续</span>'],
      ['就业', '用工量指数同比 全国(9/17)', '+0.4%', '→ 低位企稳'],
    ];
    hfData.forEach(function (r) {
      tableHtml += '<tr><td style="padding:4px 8px;border:1px solid var(--border);font-weight:600;">' + r[0] + '</td>'
        + '<td style="padding:4px 8px;border:1px solid var(--border);">' + r[1] + '</td>'
        + '<td style="padding:4px 8px;border:1px solid var(--border);font-weight:600;">' + r[2] + '</td>'
        + '<td style="padding:4px 8px;border:1px solid var(--border);">' + r[3] + '</td></tr>';
    });
    tableHtml += '</table>';
    tb.innerHTML = tableHtml;
    container.appendChild(tableCard);
    registerCard(tableCard, null, '高频表 出口 消费 地产 建筑 制造 就业 SCFI');
  }

  /* ---------------- AI压力指数子页 ---------------- */
  function renderAIPressure(container) {
    var AP = D.ai_pressure;
    if (!AP) return;
    renderToolbar(container);

    var h1 = document.createElement('div');
    h1.className = 'section-title';
    h1.textContent = 'AI金融压力指数（AFSI）';
    container.appendChild(h1);

    // AFSI 综合指数
    var ai = AP.ai_index;
    if (ai && ai.dates && ai.dates.length) {
      var aiCard = makeCard('AI金融压力指数（AFSI）', '', ai.dates[ai.dates.length - 1], true,
        '自建AI金融压力指数（覆盖信贷/市场/AI活跃度/硬件四维13指标，每周更新）。'
        + '最新读数 ' + (ai.index[ai.index.length - 1] || 0).toFixed(1) + '。'
        + '信号含义：>70 警戒（控制仓位），>80 危险，50 中性。自建模型逐周更新。', 'AFSI综合');
      container.appendChild(aiCard);
      var aiChart = echarts.init(aiCard.querySelector('.card-body'));
      var aiOpt = baseLineOption('');
      aiOpt.series = [{ name: 'AFSI', type: 'line', showSymbol: false,
        lineStyle: { width: 1.8, color: '#dc2626' }, itemStyle: { color: '#dc2626' },
        emphasis: { focus: 'series' },
        areaStyle: { color: 'rgba(220,38,38,0.06)' },
        data: pairDates(ai.dates, ai.index),
        markLine: { silent: true, symbol: 'none', lineStyle: { type: 'dashed', width: 1 },
          data: [
            { yAxis: 70, lineStyle: { color: '#d97706' }, label: { formatter: '警戒 70', fontSize: 10, color: '#d97706' } },
            { yAxis: 80, lineStyle: { color: '#dc2626' }, label: { formatter: '危险 80', fontSize: 10, color: '#dc2626' } },
            { yAxis: 50, lineStyle: { color: '#94a3b8' }, label: { formatter: '中性 50', fontSize: 10, color: '#94a3b8' } }
          ] } }];
      aiChart.setOption(aiOpt);
      charts.push(aiChart);
      addZoomHover(aiCard, aiChart);
      registerCard(aiCard, aiChart, 'AFSI AI压力指数 综合');
    }

    // 12 组件拆分
    var comp = AP.components;
    if (comp && comp.dates && comp.dates.length) {
      var cCard = makeCard('AFSI 12组件拆分', '', comp.dates[comp.dates.length - 1], true,
        '信贷：Capex/OCF、AI_IG_Spread、HY_IG_Percentile、CoreWeave_Spread；'
        + '硬件：H100_Drawdown、SOFR；'
        + '市场：Growth_Value、PEG、MA30_Breadth、Volatility、Big10_Conc、Cover_Ratio。'
        + '每组件0-100标准化。', 'AFSI组件');
      container.appendChild(cCard);
      var cChart = echarts.init(cCard.querySelector('.card-body'));
      var cOpt = baseLineOption('');
      cOpt.series = comp.header.filter(function (h) { return h && h !== comp.header[0]; }).map(function (h) {
        return { name: h, type: 'line', showSymbol: false, lineStyle: { width: 1.2 },
          emphasis: { focus: 'series' }, data: pairDates(comp.dates, comp.data[h]) };
      });
      cChart.setOption(cOpt);
      charts.push(cChart);
      addZoomHover(cCard, cChart);
      registerCard(cCard, cChart, 'AFSI组件 ' + comp.header.join(' '));
    }

    var h2 = document.createElement('div');
    h2.className = 'section-title';
    h2.textContent = '信用端（CDS & OAS）';
    container.appendChild(h2);

    // 科技巨头CDS
    var cds = AP.cds;
    if (cds && cds.dates && cds.dates.length) {
      var cdsNames = cds.header;
      var cdsCard = makeCard('科技巨头 5Y CDS 利差（bp）', 'bp', cds.dates[cds.dates.length - 1], true,
        '每日更新。'
        + 'NVDA CDS ' + (cds.data['NVDA (L1)'] ? (cds.data['NVDA (L1)'][cds.data['NVDA (L1)'].length - 1] || 0).toFixed(0) + 'bp' : '-')
        + '（近期升幅显著），HY ' + (cds.data['高收益公司债 (R2)'] ? (cds.data['高收益公司债 (R2)'][cds.data['高收益公司债 (R2)'].length - 1] || 0).toFixed(0) + 'bp' : '-')
        + '。科技CDS走阔=AI信贷风险升温信号。', 'AI_CDS');
      container.appendChild(cdsCard);
      var cdsChart = echarts.init(cdsCard.querySelector('.card-body'));
      var cdsOpt = baseLineOption('bp');
      cdsOpt.series = cdsNames.filter(function (h) { return h && h !== cdsNames[0]; }).map(function (h) {
        var v = cds.data[h];
        return { name: h, type: 'line', showSymbol: false, lineStyle: { width: 1.3 },
          emphasis: { focus: 'series' }, data: pairDates(cds.dates, v) };
      });
      cdsChart.setOption(cdsOpt);
      charts.push(cdsChart);
      addZoomHover(cdsCard, cdsChart);
      registerCard(cdsCard, cdsChart, 'CDS 科技 MSFT GOOG NVDA IG HY');
    }

    // OAS利差
    var oas = AP.oas;
    if (oas && oas.dates && oas.dates.length) {
      var oasCard = makeCard('期权调整利差 OAS（bp）', 'bp', oas.dates[oas.dates.length - 1], true,
        '信用利差走阔=融资环境收紧。', 'AI_OAS');
      container.appendChild(oasCard);
      var oasChart = echarts.init(oasCard.querySelector('.card-body'));
      var oasOpt = baseLineOption('bp');
      oasOpt.series = oas.header.filter(function (h) { return h && h !== oas.header[0]; }).map(function (h) {
        return { name: h, type: 'line', showSymbol: false, lineStyle: { width: 1.3 },
          emphasis: { focus: 'series' }, data: pairDates(oas.dates, oas.data[h]) };
      });
      oasChart.setOption(oasOpt);
      charts.push(oasChart);
      addZoomHover(oasCard, oasChart);
      registerCard(oasCard, oasChart, 'OAS 利差 信用');
    }

    var h3 = document.createElement('div');
    h3.className = 'section-title';
    h3.textContent = 'AI景气度（OpenRouter 调用量 / GPU / ARR / Capex）';
    container.appendChild(h3);

    // OpenRouter 周度调用量（柱）+ 环比（右轴线），替换原 Token 支出指数
    var or_ = AP.openrouter;
    if (or_ && or_.weeks && or_.weeks.length) {
      var orMom = (or_.mom || []).map(function (v) { return v == null ? null : +(v * 100).toFixed(2); });
      var orLast = or_.calls[or_.calls.length - 1];
      var orMomLast = orMom.length ? orMom[orMom.length - 1] : null;
      var top3 = (or_.models || []).slice(0, 3).map(function (m) {
        return m.name + ' ' + (m.share * 100).toFixed(1) + '%';
      }).join('、');
      var orCard = makeCard('OpenRouter 周度 Token 调用量（万亿/周）', '万亿/周', or_.weeks[or_.weeks.length - 1], true,
        'OpenRouter 平台大模型 token 消耗（周度）。最新 ' + num1(orLast) + ' 万亿/周'
        + '（环比 ' + (orMomLast == null ? '-' : (orMomLast >= 0 ? '+' : '') + num1(orMomLast) + '%）')
        + '。2026 年调用量加速上台阶：2 月破 14 万亿、6 月破 44 万亿、8 月单周破 110 万亿。'
        + '模型结构：前九大占 62.0%，Top3 ' + top3 + '。'
        + '调用量环比持续为正=AI 应用景气扩张。', 'AI_Token');
      container.appendChild(orCard);
      var orChart = echarts.init(orCard.querySelector('.card-body'));
      var orOpt = {
        grid: { left: 56, right: 56, top: 40, bottom: 58 },
        legend: { top: 2, icon: 'roundRect', itemWidth: 12, itemHeight: 3, textStyle: { fontSize: 11, color: '#4b5563' } },
        tooltip: { trigger: 'axis', axisPointer: { type: 'cross' },
          backgroundColor: 'rgba(255,255,255,.96)', borderColor: '#e5e8ef',
          textStyle: { color: '#1f2430', fontSize: 12 },
          formatter: function (ps) {
            var s = ps[0].name;
            ps.forEach(function (p) {
              var v = p.value;
              if (v == null) return;
              s += '<br>' + p.marker + p.seriesName + ': ' + (p.seriesName.indexOf('环比') >= 0 ? num2(v) + '%' : num2(v));
            });
            return s;
          } },
        xAxis: { type: 'category', data: or_.weeks,
          axisLabel: { color: '#6b7280', fontSize: 10, rotate: 45 },
          axisLine: { lineStyle: { color: '#d5dae3' } } },
        yAxis: [
          { type: 'value', name: '万亿/周', scale: true,
            axisLabel: { color: '#6b7280', fontSize: 10 }, splitLine: { lineStyle: { color: '#eef1f6' } } },
          { type: 'value', name: '环比%', position: 'right', scale: true,
            axisLabel: { color: '#94a3b8', fontSize: 10, formatter: function (v) { return v + '%'; } },
            splitLine: { show: false },
            axisLine: { show: false } }
        ],
        series: [
          { name: '周度调用量', type: 'bar', barMaxWidth: 14,
            data: or_.calls, itemStyle: { color: '#2563eb', borderRadius: [2, 2, 0, 0] } },
          { name: '环比（右轴）', type: 'line', yAxisIndex: 1, showSymbol: false,
            lineStyle: { width: 1.6, color: '#d97706' }, itemStyle: { color: '#d97706' },
            emphasis: { focus: 'series' }, data: orMom,
            markLine: { silent: true, symbol: 'none', lineStyle: { color: '#c3c9d4', width: 1, type: 'dashed' },
              data: [{ yAxis: 0, label: { show: false } }] } }
        ]
      };
      orChart.setOption(orOpt);
      charts.push(orChart);
      addZoomHover(orCard, orChart);
      registerCard(orCard, orChart, 'OpenRouter Token 调用量 AI景气 环比');
    }

    // GPU租赁价格
    var gpu = AP.gpu;
    if (gpu && gpu.dates && gpu.dates.length) {
      var gpuCard = makeCard('GPU 租赁价格', '$', gpu.dates[gpu.dates.length - 1], true,
        '来源 AI指数材料底稿。H100租赁价格持续下跌=算力供给增加或需求边际放缓。', 'AI_GPU');
      container.appendChild(gpuCard);
      var gpuChart = echarts.init(gpuCard.querySelector('.card-body'));
      var gpuOpt = baseLineOption('$');
      gpuOpt.series = gpu.header.filter(function (h) { return h && h !== gpu.header[0]; }).map(function (h) {
        return { name: h, type: 'line', showSymbol: false, lineStyle: { width: 1.5 },
          emphasis: { focus: 'series' }, data: pairDates(gpu.dates, gpu.data[h]) };
      });
      gpuChart.setOption(gpuOpt);
      charts.push(gpuChart);
      addZoomHover(gpuCard, gpuChart);
      registerCard(gpuCard, gpuChart, 'GPU 租赁价格 H100');
    }

    var h4 = document.createElement('div');
    h4.className = 'section-title';
    h4.textContent = 'AI Capex 与 ARR';
    container.appendChild(h4);

    // ARR 月度图（OpenAI / Anthropic 分组柱 + tooltip MoM）
    var arrD = AP.arr;
    if (arrD && arrD.months && arrD.months.length) {
      var arrLastO = arrD.openai[arrD.openai.length - 1];
      var arrLastA = arrD.anthropic[arrD.anthropic.length - 1];
      var arrCard = makeCard('OpenAI / Anthropic 月度 ARR（亿美元）', '亿美元', '26/08E', true,
        'ARR（Annual Recurring Revenue，年化经常性收入）。最新（26/08E）：OpenAI $' + num1(arrLastO / 10) + 'B、'
        + 'Anthropic $' + num1(arrLastA / 10) + 'B，Anthropic 已反超 OpenAI。'
        + 'ARR 覆盖率（ARR/Capex）是判断 AI 基建回报可持续性的核心指标：'
        + 'ARR 增速放缓→Capex 回报率下降→AI 压力指数上升。', 'AI_ARR');
      container.appendChild(arrCard);
      var arrChart = echarts.init(arrCard.querySelector('.card-body'));
      var arrOpt = {
        grid: { left: 52, right: 20, top: 40, bottom: 56 },
        legend: { top: 2, icon: 'roundRect', itemWidth: 12, itemHeight: 3, textStyle: { fontSize: 11, color: '#4b5563' } },
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' },
          backgroundColor: 'rgba(255,255,255,.96)', borderColor: '#e5e8ef',
          textStyle: { color: '#1f2430', fontSize: 12 },
          formatter: function (ps) {
            var i = ps[0].dataIndex;
            var s = ps[0].name;
            if (arrD.openai[i] != null) s += '<br>OpenAI: ' + num1(arrD.openai[i]) + ' 亿美元'
              + (arrD.openai_mom[i] != null ? '（MoM ' + (arrD.openai_mom[i] >= 0 ? '+' : '') + num1(arrD.openai_mom[i] * 100) + '%）' : '');
            if (arrD.anthropic[i] != null) s += '<br>Anthropic: ' + num1(arrD.anthropic[i]) + ' 亿美元'
              + (arrD.anthropic_mom[i] != null ? '（MoM ' + (arrD.anthropic_mom[i] >= 0 ? '+' : '') + num1(arrD.anthropic_mom[i] * 100) + '%）' : '');
            return s;
          } },
        xAxis: { type: 'category', data: arrD.months,
          axisLabel: { color: '#6b7280', fontSize: 10, rotate: 45 },
          axisLine: { lineStyle: { color: '#d5dae3' } } },
        yAxis: { type: 'value', name: '亿美元',
          axisLabel: { color: '#6b7280', fontSize: 10 }, splitLine: { lineStyle: { color: '#eef1f6' } } },
        series: [
          { name: 'OpenAI', type: 'bar', barMaxWidth: 16,
            data: arrD.openai, itemStyle: { color: '#2563eb', borderRadius: [2, 2, 0, 0] } },
          { name: 'Anthropic', type: 'bar', barMaxWidth: 16,
            data: arrD.anthropic, itemStyle: { color: '#d97706', borderRadius: [2, 2, 0, 0] } }
        ]
      };
      arrChart.setOption(arrOpt);
      charts.push(arrChart);
      addZoomHover(arrCard, arrChart);
      registerCard(arrCard, arrChart, 'ARR OpenAI Anthropic 月度收入');
    }

    // Capex 图（四大厂商分组柱 + 合计折线）
    var capD = AP.capex;
    if (capD && capD.years && capD.years.length) {
      var capColors = { '谷歌': '#2563eb', '亚马逊': '#d97706', '微软': '#16a34a', 'Meta': '#7c3aed' };
      var capCard = makeCard('超大规模厂商 Capex（亿美元 · 日历年口径）', '亿美元', capD.adj_date || '2026', true,
        '四大厂商资本开支预测（日历年口径）。2026E 合计 $' + num1(capD.total[2] / 10) + 'B'
        + '（yoy +' + num1(capD.total_yoy[0] * 100) + '%），2027E $' + num1(capD.total[3] / 10) + 'B'
        + '（+' + num1(capD.total_yoy[1] * 100) + '%）。'
        + 'Capex 超预期=AI 基建扩张，对长债形成挤出效应（约 1/8~1/4 久期挤出）。', 'AI_CAPEX');
      container.appendChild(capCard);
      var capChart = echarts.init(capCard.querySelector('.card-body'));
      var capOpt = {
        grid: { left: 56, right: 20, top: 40, bottom: 40 },
        legend: { top: 2, icon: 'roundRect', itemWidth: 12, itemHeight: 3, textStyle: { fontSize: 11, color: '#4b5563' } },
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' },
          backgroundColor: 'rgba(255,255,255,.96)', borderColor: '#e5e8ef',
          textStyle: { color: '#1f2430', fontSize: 12 },
          formatter: function (ps) {
            var i = ps[0].dataIndex;
            var s = capD.years[i];
            ps.forEach(function (p) {
              if (p.value != null) s += '<br>' + p.marker + p.seriesName + ': ' + num1(p.value) + ' 亿美元';
            });
            if (capD.total_yoy[i] != null && i >= 1) s += '<br>合计 yoy: ' + (capD.total_yoy[i - 1] >= 0 ? '+' : '') + num1(capD.total_yoy[i - 1] * 100) + '%';
            return s;
          } },
        xAxis: { type: 'category', data: capD.years,
          axisLabel: { color: '#6b7280', fontSize: 11 },
          axisLine: { lineStyle: { color: '#d5dae3' } } },
        yAxis: { type: 'value', name: '亿美元',
          axisLabel: { color: '#6b7280', fontSize: 10 }, splitLine: { lineStyle: { color: '#eef1f6' } } },
        series: capD.companies.map(function (c) {
          return { name: c.name, type: 'bar', barMaxWidth: 18,
            data: c.values, itemStyle: { color: capColors[c.name] || '#64748b', borderRadius: [2, 2, 0, 0] } };
        }).concat([
          { name: '合计（右轴同刻度）', type: 'line', showSymbol: true, symbolSize: 5,
            lineStyle: { width: 2, color: '#334155' }, itemStyle: { color: '#334155' },
            emphasis: { focus: 'series' }, data: capD.total,
            label: { show: true, fontSize: 10, color: '#334155', position: 'top',
              formatter: function (p) { return p.value >= 1000 ? (p.value / 1000).toFixed(1) + 'k' : p.value; } } }
        ])
      };
      capChart.setOption(capOpt);
      charts.push(capChart);
      addZoomHover(capCard, capChart);
      registerCard(capCard, capChart, 'Capex 谷歌 亚马逊 微软 Meta 资本开支 790B');
    }
  }

  /* ---------------- 空模块 ---------------- */
  function renderEmpty(container, mod) {
    var box = document.createElement('div');
    box.className = 'empty';
    box.innerHTML =
      '<div class="empty-title">「' + mod.name + '」模块待接入</div>' +
      '<div class="empty-desc">按规划补充数据后接入：<br>' +
        '<code>data_macro_cn.js</code> / <code>data_macro_global.js</code><br>' +
        '后续版本补充：国内宏观（增长/通胀/流动性/信用）、海外宏观（美债/美元/流动性）。</div>';
    container.appendChild(box);
  }

  /* ---------------- 主入口 ---------------- */
  function switchModule(id, section, silent) {
    currentModule = id;
    currentSection = section;
    if (!silent) {
      try { location.hash = id + (section ? '/' + encodeURIComponent(section) : ''); } catch (e) {}
    }
    clearCanvas();
    renderNav();
    var mod = MODULES.filter(function (m) { return m.id === id; })[0];
    // section 校验：无效（旧链接/拼写错误）时回退到第一个子分页，避免标题显示 undefined
    if (mod.children && mod.children.length) {
      var validSec = mod.children.some(function (c) { return c.section === section; });
      if (!validSec) { section = mod.children[0].section; currentSection = section; }
    }
    document.getElementById('module-title').textContent =
      mod.name + (section ? ' · ' + (mod.children.filter(function (c) { return c.section === section; })[0] || {}).name : '');
    var subs = { overview: '三维行业比较：盈利 · 估值 · 情绪', valuation: 'PE/PB十年序列 · 十年分位 · 远期PE(26E/27E) · 一级/二级行业',
      earnings: '一致预期增速 · 本周vs上周修正 · 二阶导 · ROE', sentiment: '大盘 · 风格 · 行业情绪 · 机构持仓',
      macro_cn: '金融领先 · 增长出口 · K型 · 物价',
      liquidity: '私募仓位 · 两融 · ETF · 新备案 · 量化净值',
      macro_global: '美债分解 · CDS · 利率期货 · PCE · 油价',
      scoring: '五维打分 · PB-ROE · PEG · 胜率-赔率象限' };
    document.getElementById('topbar-sub').textContent = subs[id] || '';
    var content = document.getElementById('content');
    content.innerHTML = '';
    try {
      if (id === 'overview') { renderOverview(content); }
      else if (id === 'weekly') { renderWeekly(content); }
      else if (id === 'valuation') { renderToolbar(content); renderValuation(content, section); }
      else if (id === 'earnings') { renderToolbar(content); renderEarnings(content, section); }
      else if (id === 'sentiment') { renderToolbar(content); renderSentiment(content, section); }
      else if (id === 'macro_cn') {
        if (section === 'hf') { renderHighFreq(content); }
        else { renderMacroCn(content); }
      }
      else if (id === 'liquidity') { renderLiquidity(content); }
      else if (id === 'macro_global') {
        if (section === 'ai') { renderAIPressure(content); }
        else { renderMacroGlobal(content); }
      }
      else if (id === 'scoring') { renderScoring(content); }
      else { renderEmpty(content, mod); }
    } catch (err) {
      // 单个模块渲染失败不应导致整页白屏
      console.error('[DashBoard] 模块渲染失败:', id, err);
      content.innerHTML = '<div class="empty"><div style="font-size:15px;font-weight:600;color:#dc2626;margin-bottom:8px;">'
        + '「' + mod.name + '」渲染出错</div>'
        + '<div style="font-size:12px;color:#6b7280;line-height:1.8;">'
        + '缺失数据模块：' + (D && Object.keys(D).filter(function (k) { return D[k] && Object.keys(D[k]).length === 0; }).join(', ') || '无')
        + '<br>错误：' + (err && err.message ? err.message : String(err))
        + '<br><br>请刷新页面重试；若持续出现，检查浏览器控制台（F12）的网络面板。</div></div>';
    }
    applyRange();
    // 渲染完成后 resize
    setTimeout(function () {
      charts.forEach(function (c) { c.resize(); });
    }, 60);
  }

  window.addEventListener('hashchange', function () {
    var h = (location.hash || '').replace('#', '');
    if (!h) return;
    var parts = h.split('/');
    var id = parts[0];
    var sec = parts[1] ? decodeURIComponent(parts[1]) : null;
    var mod = MODULES.filter(function (m) { return m.id === id; })[0];
    if (!mod) return;
    if (mod.children && sec) expandedModules[id] = true;
    switchModule(id, sec, true);
  });

  // 初始路由：支持 #valuation/申万一级行业 直达
  // 等待数据加载完成（支持外挂JSON和内嵌数据两种模式）
  function boot() {
    D = window.DASH || {};  // 外挂模式：此时数据已 fetch 完成
    // 补全缺失模块，避免因单个模块加载失败导致渲染崩溃
    ['meta', 'valuation', 'earnings', 'sentiment', 'macro_cn', 'liquidity',
     'macro_global', 'scoring', 'hf_macro', 'ai_pressure', 'earnings_ts'].forEach(function (k) {
      if (!D[k]) D[k] = {};
    });
    var h = (location.hash || '').replace('#', '');
    if (h) {
      var parts = h.split('/');
      var mod = MODULES.filter(function (m) { return m.id === parts[0]; })[0];
      if (mod) {
        if (mod.children && parts[1]) expandedModules[parts[0]] = true;
        switchModule(parts[0], parts[1] ? decodeURIComponent(parts[1]) : null, true);
        return;
      }
    }
    renderHealth();
    switchModule('overview', null, true);
  }

  if (window.DASH) {
    // 内嵌数据模式（单文件版）
    boot();
  } else {
    // 外挂JSON模式：等待 dash-ready 事件
    window.addEventListener('dash-ready', boot);
  }
})();
