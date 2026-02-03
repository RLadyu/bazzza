const twoGroupDefault = `STREAM 1; Nunn A.J., 2019\t193\t245\t99\t124
MDR-END; Mok J., 2022\t54\t72\t60\t85
endTB Trial; Guglielmetti, 2024\t495\t580\t96\t119
STREAM Stage 2; Goodall RL 9\t162\t196\t133\t187
BEAT TB; Conradie F., 2023\t174\t202\t172\t200
TB PRACTECAL; Nyang’wa, 2024\t122\t138\t81\t137
endTB-Q; Guglielmetti L., 2025\t141\t163\t75\t84
NExT trial; Esmail A., 2022\t33\t49\t30\t44
STREAM Stage 2; Goodall RL 6\t162\t196\t87\t127
Марьяндышев А.О., 2019\t145\t179\t129\t180
Ndjeka N., 2022\t507\t688\t421\t699`;

const oneGroupDefault = `STREAM 1; Nunn A.J., 2019\t6\t193\t6-9 мес
MDR-END; Mok J., 2022\t1\t54\t6-9 мес
endTB Trial; Guglielmetti, 2024\t3\t580\t6-9 мес
STREAM Stage 2; Goodall RL 9\t2\t196\t6-9 мес
Марьяндышев А.О., 2019\t0\t145\t6-9 мес
BEAT TB; Conradie F., 2023\t10\t202\t6-9 мес
TB PRACTECAL; Nyang’wa, 2024\t1\t138\t6-9 мес
endTB-Q; Guglielmetti L., 2025\t9\t163\t6-9 мес
NExT trial; Esmail A., 2022\t1\t49\t6-9 мес
STREAM Stage 2; Goodall RL 6\t1\t134\t6-9 мес
Korotych O., 2024\t22\t2181\t9-12 мес
Schwœbel, 2020\t14\t823\t9-12 мес
ZeNix; Conradie, 2022\t6\t176\t9-12 мес
Химова Е.С., 2025\t2\t137\t9-12 мес
Fardhdiani; 2021\t1\t234\t9-12 мес
Sinha; 2025\t2\t383\t9-12 мес
BEAT-India; Padmapriyadarsini\t3\t139\t9-12 мес
Burhan; 2025\t0\t69\t9-12 мес
BIG cohort; Haley, 2023\t2\t68\t9-12 мес
Ndjeka N., 2022\t1\t507\t9-12 мес
Le T. N. Anh, 2020\t0\t79\t9-12 мес
Голубчиков П.Н., 2023\t0\t36\t9-12 мес
Gualano; 2025 (серия)\t1\t19\t9-12 мес`;

const twoGroupDataEl = document.getElementById("twoGroupData");
const oneGroupDataEl = document.getElementById("oneGroupData");
const sensitivityToggle = document.getElementById("sensitivityToggle");
const recalcBtn = document.getElementById("recalcBtn");

if (twoGroupDataEl) twoGroupDataEl.value = twoGroupDefault;
if (oneGroupDataEl) oneGroupDataEl.value = oneGroupDefault;

const formatNumber = (value, digits = 3) => {
  if (!Number.isFinite(value)) return "—";
  return Number(value).toFixed(digits);
};

const formatPercent = (value, digits = 1) => `${formatNumber(value, digits)}%`;

const getDelimiter = (line) => {
  if (line.includes("\t")) return "\t";
  if (line.includes(";")) return ";";
  return ",";
};

const parseRows = (raw) => {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
};

const parseTwoGroup = (raw) => {
  const rows = parseRows(raw);
  return rows.map((line) => {
    const delimiter = getDelimiter(line);
    const parts = line.split(delimiter).map((part) => part.trim());
    const numericParts = parts.slice(-4);
    const study = parts.slice(0, parts.length - 4).join(delimiter).trim();
    const [a, n1, c, n0] = numericParts.map((value) => Number(value));
    return { study, a, n1, c, n0 };
  });
};

const parseOneGroup = (raw) => {
  const rows = parseRows(raw);
  return rows.map((line) => {
    const delimiter = getDelimiter(line);
    const parts = line.split(delimiter).map((part) => part.trim());
    const numericParts = parts.slice(-2);
    const subgroup = parts.length > 3 ? parts[parts.length - 1] : "";
    const study = parts.slice(0, parts.length - (parts.length > 3 ? 3 : 2)).join(delimiter).trim();
    const [x, n] = numericParts.map((value) => Number(value));
    return { study, x, n, subgroup };
  });
};

const calculateTwoGroup = (data) => {
  const valid = data.filter((d) => d.study && d.n1 > 0 && d.n0 > 0);
  const effects = valid.map((d) => {
    const rr = (d.a / d.n1) / (d.c / d.n0);
    const y = Math.log(rr);
    const se = Math.sqrt((1 / d.a - 1 / d.n1) + (1 / d.c - 1 / d.n0));
    const ciLow = Math.exp(y - 1.96 * se);
    const ciHigh = Math.exp(y + 1.96 * se);
    return { ...d, rr, y, se, ciLow, ciHigh };
  });

  const weightsFE = effects.map((d) => 1 / (d.se ** 2));
  const sumWeightsFE = weightsFE.reduce((sum, w) => sum + w, 0);
  const muFE = effects.reduce((sum, d, i) => sum + weightsFE[i] * d.y, 0) / sumWeightsFE;
  const q = effects.reduce((sum, d, i) => sum + weightsFE[i] * (d.y - muFE) ** 2, 0);
  const k = effects.length;
  const c = sumWeightsFE - (weightsFE.reduce((sum, w) => sum + w ** 2, 0) / sumWeightsFE);
  const tau2 = Math.max(0, (q - (k - 1)) / c);

  const weightsRE = effects.map((d) => 1 / (d.se ** 2 + tau2));
  const sumWeightsRE = weightsRE.reduce((sum, w) => sum + w, 0);
  const muRE = effects.reduce((sum, d, i) => sum + weightsRE[i] * d.y, 0) / sumWeightsRE;
  const seRE = Math.sqrt(1 / sumWeightsRE);
  const pooled = Math.exp(muRE);
  const pooledLow = Math.exp(muRE - 1.96 * seRE);
  const pooledHigh = Math.exp(muRE + 1.96 * seRE);
  const i2 = q > 0 ? Math.max(0, (q - (k - 1)) / q) * 100 : 0;

  const rows = effects.map((d, i) => ({
    ...d,
    weightPct: (weightsRE[i] / sumWeightsRE) * 100,
  }));

  return {
    rows,
    pooled,
    pooledLow,
    pooledHigh,
    i2,
    tau2,
    q,
    k,
  };
};

const ftTransform = (x, n) => {
  const term1 = Math.asin(Math.sqrt(x / (n + 1)));
  const term2 = Math.asin(Math.sqrt((x + 1) / (n + 1)));
  return term1 + term2;
};

const ftBackTransform = (y) => {
  return Math.sin(y / 2) ** 2;
};

const calculateOneGroup = (data, useSensitivity) => {
  const adjusted = data.map((d) => {
    if (useSensitivity && d.study.toLowerCase().includes("endtb-q")) {
      return { ...d, x: Math.max(0, d.x - 1) };
    }
    return d;
  });

  const valid = adjusted.filter((d) => d.study && d.n > 0);
  const effects = valid.map((d) => {
    const p = d.x / d.n;
    const y = ftTransform(d.x, d.n);
    const v = 1 / (d.n + 0.5);
    const ciLow = Math.max(0, d.x === 0 ? 0 : p - 1.96 * Math.sqrt((p * (1 - p)) / d.n));
    const ciHigh = Math.min(1, p + 1.96 * Math.sqrt((p * (1 - p)) / d.n));
    return { ...d, p, y, v, ciLow, ciHigh };
  });

  const weightsFE = effects.map((d) => 1 / d.v);
  const sumWeightsFE = weightsFE.reduce((sum, w) => sum + w, 0);
  const muFE = effects.reduce((sum, d, i) => sum + weightsFE[i] * d.y, 0) / sumWeightsFE;
  const q = effects.reduce((sum, d, i) => sum + weightsFE[i] * (d.y - muFE) ** 2, 0);
  const df = effects.length - 1;
  const c = sumWeightsFE - (weightsFE.reduce((sum, w) => sum + w ** 2, 0) / sumWeightsFE);
  const tau2 = Math.max(0, (q - df) / c);

  const weightsRE = effects.map((d) => 1 / (d.v + tau2));
  const sumWeightsRE = weightsRE.reduce((sum, w) => sum + w, 0);
  const muRE = effects.reduce((sum, d, i) => sum + weightsRE[i] * d.y, 0) / sumWeightsRE;
  const seRE = Math.sqrt(1 / sumWeightsRE);
  const pooled = ftBackTransform(muRE);
  const pooledLow = ftBackTransform(muRE - 1.96 * seRE);
  const pooledHigh = ftBackTransform(muRE + 1.96 * seRE);
  const pooledFE = ftBackTransform(muFE);
  const pooledFELow = ftBackTransform(muFE - 1.96 * Math.sqrt(1 / sumWeightsFE));
  const pooledFEHigh = ftBackTransform(muFE + 1.96 * Math.sqrt(1 / sumWeightsFE));
  const i2 = q > 0 ? Math.max(0, (q - df) / q) * 100 : 0;

  return {
    rows: effects,
    pooled,
    pooledLow,
    pooledHigh,
    pooledFE,
    pooledFELow,
    pooledFEHigh,
    i2,
    tau2,
    q,
  };
};

const buildForest = ({ rows, pooled, pooledLow, pooledHigh, scaleMin, scaleMax, isLog }) => {
  const width = 580;
  const rowHeight = 28;
  const height = Math.max(160, rows.length * rowHeight + 80);
  const margin = { top: 30, left: 20, right: 20, bottom: 30 };
  const axisY = height - margin.bottom;

  const scale = (value) => {
    if (isLog) {
      const logMin = Math.log10(scaleMin);
      const logMax = Math.log10(scaleMax);
      const logVal = Math.log10(value);
      return margin.left + ((logVal - logMin) / (logMax - logMin)) * (width - margin.left - margin.right);
    }
    return margin.left + ((value - scaleMin) / (scaleMax - scaleMin)) * (width - margin.left - margin.right);
  };

  const axisLine = `<line x1="${margin.left}" x2="${width - margin.right}" y1="${axisY}" y2="${axisY}" stroke="#c6cedf" />`;
  const refLineX = scale(isLog ? 1 : pooled);
  const refLine = `<line x1="${refLineX}" x2="${refLineX}" y1="${margin.top}" y2="${axisY}" stroke="#3366ff" stroke-dasharray="4 3" />`;

  const rowsSvg = rows.map((row, index) => {
    const y = margin.top + index * rowHeight + 12;
    const x1 = scale(row.ciLow || row.ciLower || row.ciLow);
    const x2 = scale(row.ciHigh || row.ciUpper || row.ciHigh);
    const cx = scale(row.rr ?? row.p);
    const size = Math.max(4, Math.min(12, (row.weightPct || 6) / 2));
    return `
      <line x1="${x1}" x2="${x2}" y1="${y}" y2="${y}" stroke="#6f87c5" stroke-width="2" />
      <rect x="${cx - size / 2}" y="${y - size / 2}" width="${size}" height="${size}" fill="#f97316" />
    `;
  }).join("");

  const pooledY = margin.top + rows.length * rowHeight + 16;
  const pooledX = scale(pooled);
  const pooledXLow = scale(pooledLow);
  const pooledXHigh = scale(pooledHigh);
  const diamond = `
    <polygon points="${pooledXLow},${pooledY} ${pooledX},${pooledY - 8} ${pooledXHigh},${pooledY} ${pooledX},${pooledY + 8}" fill="#22c55e" />
  `;

  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Forest plot">
    ${axisLine}
    ${refLine}
    ${rowsSvg}
    ${diamond}
    <text x="${margin.left}" y="${height - 8}" font-size="10" fill="#6b7280">${scaleMin}</text>
    <text x="${width - margin.right - 20}" y="${height - 8}" font-size="10" fill="#6b7280">${scaleMax}</text>
  </svg>`;
};

const renderTwoGroup = () => {
  const data = parseTwoGroup(twoGroupDataEl.value);
  const results = calculateTwoGroup(data);

  const summaryEl = document.getElementById("twoGroupSummary");
  summaryEl.innerHTML = `
    <h3>Сводный эффект (случайные эффекты)</h3>
    <div class="value">RR = ${formatNumber(results.pooled)} (${formatNumber(results.pooledLow)}–${formatNumber(results.pooledHigh)})</div>
    <p>I² = ${formatPercent(results.i2)} · τ² = ${formatNumber(results.tau2, 4)} · k = ${results.k}</p>
  `;

  const tbody = document.querySelector("#twoGroupTable tbody");
  tbody.innerHTML = "";
  results.rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.study}</td>
      <td>${row.a}/${row.n1}</td>
      <td>${row.c}/${row.n0}</td>
      <td>${formatNumber(row.rr)}</td>
      <td>${formatNumber(row.ciLow)}–${formatNumber(row.ciHigh)}</td>
      <td>${formatNumber(row.weightPct, 1)}</td>
    `;
    tbody.appendChild(tr);
  });

  const forestEl = document.getElementById("twoGroupForest");
  forestEl.innerHTML = buildForest({
    rows: results.rows,
    pooled: results.pooled,
    pooledLow: results.pooledLow,
    pooledHigh: results.pooledHigh,
    scaleMin: 0.5,
    scaleMax: 2,
    isLog: true,
  });
};

const renderOneGroup = () => {
  const data = parseOneGroup(oneGroupDataEl.value);
  const results = calculateOneGroup(data, sensitivityToggle.checked);

  const summaryEl = document.getElementById("oneGroupSummary");
  summaryEl.innerHTML = `
    <h3>Сводная частота (случайные эффекты)</h3>
    <div class="value">${formatNumber(results.pooled, 3)} (${formatNumber(results.pooledLow, 3)}–${formatNumber(results.pooledHigh, 3)})</div>
    <p>I² = ${formatPercent(results.i2)} · τ² = ${formatNumber(results.tau2, 4)}</p>
    <p>Фиксированный эффект: ${formatNumber(results.pooledFE, 3)} (${formatNumber(results.pooledFELow, 3)}–${formatNumber(results.pooledFEHigh, 3)})</p>
  `;

  const tbody = document.querySelector("#oneGroupTable tbody");
  tbody.innerHTML = "";
  results.rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.study}</td>
      <td>${row.x}/${row.n}</td>
      <td>${formatNumber(row.p, 3)}</td>
      <td>${formatNumber(row.ciLow, 3)}–${formatNumber(row.ciHigh, 3)}</td>
      <td>${row.subgroup || "—"}</td>
    `;
    tbody.appendChild(tr);
  });

  const forestEl = document.getElementById("oneGroupForest");
  const maxCi = Math.max(...results.rows.map((row) => row.ciHigh));
  const maxScale = Math.max(0.08, maxCi * 1.1);
  forestEl.innerHTML = buildForest({
    rows: results.rows.map((row) => ({
      ...row,
      rr: row.p,
      ciLow: row.ciLow,
      ciHigh: row.ciHigh,
      weightPct: 6,
    })),
    pooled: results.pooled,
    pooledLow: results.pooledLow,
    pooledHigh: results.pooledHigh,
    scaleMin: 0,
    scaleMax: maxScale,
    isLog: false,
  });
};

const recalc = () => {
  renderTwoGroup();
  renderOneGroup();
};

recalcBtn.addEventListener("click", recalc);
sensitivityToggle.addEventListener("change", recalc);

document.addEventListener("DOMContentLoaded", recalc);
recalc();
