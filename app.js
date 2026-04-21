const svg = document.getElementById("graph");
const nodeLayer = document.getElementById("nodes");
const hierarchyLayer = document.getElementById("edgesHierarchy");
const semanticLayer = document.getElementById("edgesSemantic");
const legendHost = document.getElementById("legend");
const relationLegendHost = document.getElementById("relationLegend");


const RELATION_LEGEND = [
  { cls: "rel-definition", label: "Определение / логика МЛУ-ТБ" },
  { cls: "rel-regimen-drug", label: "Режим ↔ препараты" },
  { cls: "rel-drug-risk", label: "Препарат ↔ риск/НЯ" },
  { cls: "rel-risk-control", label: "Риск/НЯ ↔ контроль" },
  { cls: "rel-control-diagnostics", label: "Контроль ↔ обследование" }
];
const NODE_RADIUS = { 0: 52, 1: 34, 2: 23, 3: 20 };

const layout = {
  mld_tb: [780, 450],

  resistance: [230, 250],
  h: [130, 190], r: [130, 250], fq_res: [130, 310],

  regimens: [780, 130],
  reg_6: [640, 70], reg_bpalm: [735, 50], reg_9: [825, 50], reg_18_20: [920, 70],

  drugs: [1220, 210],
  drug_bdq: [1060, 150], drug_lzd: [1140, 150], drug_lfx: [1220, 150], drug_mfx: [1300, 150],
  drug_dlm: [1380, 150], drug_cfz: [1060, 235], drug_pa: [1140, 235], drug_cs: [1220, 235],
  drug_z: [1300, 235], drug_e: [1380, 235], drug_pas: [1140, 320], drug_pto: [1300, 320],

  risks: [1260, 430],
  risk_qtc: [1080, 390], risk_myelo: [1180, 390], risk_neuro: [1280, 390], risk_hepato: [1380, 390],
  risk_periph: [1080, 470], risk_optic: [1180, 470], risk_psy: [1280, 470], risk_electro: [1380, 470],

  control: [1260, 665],
  ctrl_ecg: [1060, 620], freq_ecg: [980, 620],
  ctrl_oak: [1140, 620], freq_oak: [1065, 655],
  ctrl_lft: [1220, 620], freq_lft: [1220, 675],
  ctrl_creat: [1300, 620],
  ctrl_kmgca: [1380, 620], freq_kmgca: [1460, 620],
  ctrl_tsh: [1060, 700],
  ctrl_neuro: [1140, 700], freq_neuro: [1220, 740],
  ctrl_opht: [1220, 700], freq_opht: [1300, 740],
  ctrl_audio: [1300, 700],

  diagnostics: [820, 770],
  diag_smear: [610, 730], diag_culture: [690, 730], diag_pcr: [770, 730], diag_ct: [850, 730],
  diag_cbc: [930, 730], diag_biochem: [1010, 730], diag_electro: [1090, 730], diag_ecg: [1170, 730],

  logic: [300, 680],
  logic_mdr: [120, 620], logic_prexdr: [120, 710], logic_profile: [300, 620], logic_monitor: [300, 710]
};

const state = {
  focusedNodeId: null,
  expanded: new Set(
    GRAPH_DATA.nodes.filter((n) => n.collapsible && n.defaultExpanded).map((n) => n.id)
  )
};

const nodesById = new Map(GRAPH_DATA.nodes.map((n) => [n.id, { ...n, children: [] }]));
GRAPH_DATA.nodes.forEach((node) => {
  if (node.parent && nodesById.has(node.parent)) {
    nodesById.get(node.parent).children.push(node.id);
  }
});

const semanticAdjacency = new Map();
GRAPH_DATA.nodes.forEach((n) => semanticAdjacency.set(n.id, new Set()));
GRAPH_DATA.edges.filter((e) => e.type === "semantic").forEach((edge) => {
  semanticAdjacency.get(edge.source)?.add(edge.target);
  semanticAdjacency.get(edge.target)?.add(edge.source);
});

function createLegend() {
  LEGEND.forEach((item) => {
    const div = document.createElement("div");
    div.className = "legend__item";
    div.innerHTML = `<span class="legend__swatch" style="background:${GROUP_COLORS[item.group]}"></span>${item.label}`;
    legendHost.appendChild(div);
  });
}


function createRelationLegend() {
  RELATION_LEGEND.forEach((item) => {
    const div = document.createElement("div");
    div.className = "legend__item legend__item--relation";
    div.innerHTML = `<span class="legend__line ${item.cls}"></span>${item.label}`;
    relationLegendHost.appendChild(div);
  });
}
function edgePath(from, to, type, sourceId, targetId) {
  const [x1, y1] = from;
  const [x2, y2] = to;
  const sourceNode = nodesById.get(sourceId);
  const targetNode = nodesById.get(targetId);

  if (sourceNode?.level === 0 || targetNode?.level === 0) {
    const c1x = x1 + (x2 - x1) * 0.35;
    const c2x = x1 + (x2 - x1) * 0.65;
    return `M ${x1} ${y1} C ${c1x} ${y1}, ${c2x} ${y2}, ${x2} ${y2}`;
  }

  if (type === "hierarchy") {
    const midY = y1 + (y2 - y1) * 0.5;
    return `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
  }

  const bend = Math.max(30, Math.min(70, Math.abs(x2 - x1) * 0.18));
  return `M ${x1} ${y1} Q ${(x1 + x2) / 2} ${(y1 + y2) / 2 - bend} ${x2} ${y2}`;
}


function relationClass(edge) {
  const pair = `${edge.source}->${edge.target}`;
  const source = edge.source;
  const target = edge.target;

  const has = (prefix, id) => id.startsWith(prefix);
  if ((has("drug_", source) && has("risk_", target)) || (has("risk_", source) && has("drug_", target))) {
    return "rel-drug-risk";
  }
  if ((has("risk_", source) && has("ctrl_", target)) || (has("ctrl_", source) && has("risk_", target))) {
    return "rel-risk-control";
  }
  if ((has("ctrl_", source) && has("diag_", target)) || (has("diag_", source) && has("ctrl_", target))) {
    return "rel-control-diagnostics";
  }
  if ((has("reg_", source) && has("drug_", target)) || (has("drug_", source) && has("reg_", target))) {
    return "rel-regimen-drug";
  }
  if (pair.includes("logic") || source === "mld_tb" || target === "mld_tb" || source === "h" || source === "r" || target === "h" || target === "r") {
    return "rel-definition";
  }
  return "rel-cross";
}
function isVisible(nodeId) {
  const node = nodesById.get(nodeId);
  if (!node?.parent) return true;

  let current = node;
  while (current.parent) {
    const parent = nodesById.get(current.parent);
    if (parent?.collapsible && !state.expanded.has(parent.id)) {
      return false;
    }
    current = parent;
  }
  return true;
}

function getAncestors(nodeId) {
  const ancestors = [];
  let current = nodesById.get(nodeId);
  while (current?.parent) {
    ancestors.push(current.parent);
    current = nodesById.get(current.parent);
  }
  return ancestors;
}

function getDescendants(nodeId, collector = new Set()) {
  const node = nodesById.get(nodeId);
  if (!node) return collector;

  node.children.forEach((childId) => {
    collector.add(childId);
    getDescendants(childId, collector);
  });
  return collector;
}

function expandPathFor(nodeId) {
  getAncestors(nodeId).forEach((ancestorId) => {
    const ancestor = nodesById.get(ancestorId);
    if (ancestor?.collapsible) {
      state.expanded.add(ancestorId);
    }
  });

  const node = nodesById.get(nodeId);
  if (node?.collapsible) {
    state.expanded.add(nodeId);
  }

  if (nodeId === "mld_tb") {
    ["resistance", "regimens", "drugs", "risks", "control", "diagnostics"].forEach((id) => state.expanded.add(id));
  }
}

function clinicalFocus(nodeId) {
  const visited = new Set([nodeId]);
  const focus = new Set([nodeId]);
  const queue = [{ id: nodeId, depth: 0 }];
  const maxDepth = 3;

  while (queue.length) {
    const current = queue.shift();
    const node = nodesById.get(current.id);
    if (!node) continue;

    getAncestors(current.id).forEach((ancestorId) => focus.add(ancestorId));
    getDescendants(current.id).forEach((descId) => focus.add(descId));

    if (current.depth >= maxDepth) continue;
    semanticAdjacency.get(current.id)?.forEach((neighborId) => {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        queue.push({ id: neighborId, depth: current.depth + 1 });
      }
      focus.add(neighborId);

      getAncestors(neighborId).forEach((ancestorId) => focus.add(ancestorId));
      if (current.depth <= 1) {
        getDescendants(neighborId).forEach((descId) => focus.add(descId));
      }
    });
  }

  return new Set([...focus].filter((id) => isVisible(id)));
}

function render() {
  hierarchyLayer.innerHTML = "";
  semanticLayer.innerHTML = "";
  nodeLayer.innerHTML = "";

  const visibleNodes = GRAPH_DATA.nodes.filter((node) => isVisible(node.id));
  const visibleSet = new Set(visibleNodes.map((n) => n.id));
  const focusSet = state.focusedNodeId ? clinicalFocus(state.focusedNodeId) : null;

  GRAPH_DATA.edges.forEach((edge) => {
    if (!visibleSet.has(edge.source) || !visibleSet.has(edge.target)) return;

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", edgePath(layout[edge.source], layout[edge.target], edge.type, edge.source, edge.target));
    path.classList.add("edge", edge.type);
    if (edge.type === "semantic") path.classList.add(relationClass(edge));

    if (focusSet) {
      const active = focusSet.has(edge.source) && focusSet.has(edge.target);
      path.classList.add(active ? "highlighted" : "dimmed");
    }

    if (edge.type === "hierarchy") {
      hierarchyLayer.appendChild(path);
    } else {
      semanticLayer.appendChild(path);
    }
  });

  visibleNodes.forEach((node) => {
    const [x, y] = layout[node.id];
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.classList.add("node", `level-${node.level}`);
    if (node.collapsible || node.level > 0) g.classList.add("interactive");

    if (focusSet) {
      g.classList.add(focusSet.has(node.id) ? "highlighted" : "dimmed");
    }
    if (state.focusedNodeId === node.id) g.classList.add("active");

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", x);
    circle.setAttribute("cy", y);
    circle.setAttribute("r", NODE_RADIUS[node.level] || 20);
    circle.setAttribute("fill", GROUP_COLORS[node.group]);

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", x);
    text.setAttribute("y", y);

    const lines = node.label.split("\n");
    lines.forEach((line, idx) => {
      const tspan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
      tspan.setAttribute("x", x);
      tspan.setAttribute("dy", idx === 0 ? `${-(lines.length - 1) * 0.5}em` : "1.2em");
      tspan.textContent = line;
      text.appendChild(tspan);
    });

    g.append(circle, text);

    g.addEventListener("click", (event) => {
      event.stopPropagation();
      const clickingFocused = state.focusedNodeId === node.id;

      if (node.collapsible && clickingFocused) {
        if (state.expanded.has(node.id)) {
          state.expanded.delete(node.id);
        } else {
          state.expanded.add(node.id);
        }
      } else {
        expandPathFor(node.id);
      }

      state.focusedNodeId = clickingFocused ? null : node.id;
      render();
    });

    nodeLayer.appendChild(g);
  });
}

svg.addEventListener("click", () => {
  state.focusedNodeId = null;
  render();
});

createLegend();
createRelationLegend();
render();
