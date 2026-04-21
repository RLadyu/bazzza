const svg = document.getElementById("graph");
const nodeLayer = document.getElementById("nodes");
const hierarchyLayer = document.getElementById("edgesHierarchy");
const semanticLayer = document.getElementById("edgesSemantic");
const resetBtn = document.getElementById("resetBtn");
const legendHost = document.getElementById("legend");

const NODE_RADIUS = { 0: 52, 1: 34, 2: 23, 3: 20 };

const layout = {
  mld_tb: [800, 450],

  resistance: [320, 250],
  h: [220, 180], r: [220, 250], fq_res: [220, 320], bdq_res: [320, 320], lzd_res: [320, 180],

  regimens: [800, 130],
  reg_6: [670, 130], reg_bpalm: [760, 70], reg_9: [840, 70], reg_18_20: [930, 130],

  drugs: [1120, 220],
  drug_bdq: [1010, 170], drug_lzd: [1075, 170], drug_lfx: [1140, 170], drug_mfx: [1205, 170],
  drug_dlm: [1270, 170], drug_cfz: [1010, 255], drug_pa: [1075, 255], drug_cs: [1140, 255],
  drug_z: [1205, 255], drug_e: [1270, 255], drug_pas: [1075, 340], drug_pto: [1205, 340],

  risks: [1220, 430],
  risk_qtc: [1070, 390], risk_myelo: [1170, 390], risk_neuro: [1270, 390], risk_hepato: [1370, 390],
  risk_periph: [1070, 470], risk_optic: [1170, 470], risk_psy: [1270, 470], risk_electro: [1370, 470],

  control: [1220, 650],
  ctrl_ecg: [1040, 610], ctrl_oak: [1120, 610], ctrl_lft: [1200, 610], ctrl_creat: [1280, 610], ctrl_kmgca: [1360, 610],
  ctrl_tsh: [1040, 690], ctrl_neuro: [1120, 690], ctrl_opht: [1200, 690], ctrl_audio: [1280, 690],

  diagnostics: [820, 760],
  diag_smear: [650, 720], diag_culture: [730, 720], diag_pcr: [810, 720], diag_ct: [890, 720],
  diag_cbc: [970, 720], diag_biochem: [1050, 720], diag_electro: [1130, 720], diag_ecg: [1210, 720],

  logic: [380, 680],
  logic_mdr: [220, 620], logic_prexdr: [220, 700], logic_profile: [380, 620], logic_monitor: [380, 700]
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

const adjacency = new Map();
GRAPH_DATA.nodes.forEach((n) => adjacency.set(n.id, new Set()));
GRAPH_DATA.edges.forEach((edge) => {
  adjacency.get(edge.source)?.add(edge.target);
  adjacency.get(edge.target)?.add(edge.source);
});

function createLegend() {
  LEGEND.forEach((item) => {
    const div = document.createElement("div");
    div.className = "legend__item";
    div.innerHTML = `<span class="legend__swatch" style="background:${GROUP_COLORS[item.group]}"></span>${item.label}`;
    legendHost.appendChild(div);
  });
}

function edgePath(from, to, type) {
  const [x1, y1] = from;
  const [x2, y2] = to;
  if (type === "hierarchy") {
    const midX = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
  }
  const bend = Math.abs(x2 - x1) < 120 ? 40 : 70;
  return `M ${x1} ${y1} Q ${(x1 + x2) / 2} ${(y1 + y2) / 2 - bend} ${x2} ${y2}`;
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

function connectedComponent(nodeId) {
  const set = new Set([nodeId]);
  adjacency.get(nodeId)?.forEach((id) => {
    if (isVisible(id)) set.add(id);
  });
  return set;
}

function render() {
  hierarchyLayer.innerHTML = "";
  semanticLayer.innerHTML = "";
  nodeLayer.innerHTML = "";

  const visibleNodes = GRAPH_DATA.nodes.filter((node) => isVisible(node.id));
  const visibleSet = new Set(visibleNodes.map((n) => n.id));
  const focusSet = state.focusedNodeId ? connectedComponent(state.focusedNodeId) : null;

  GRAPH_DATA.edges.forEach((edge) => {
    if (!visibleSet.has(edge.source) || !visibleSet.has(edge.target)) return;

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", edgePath(layout[edge.source], layout[edge.target], edge.type));
    path.classList.add("edge", edge.type);

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
    const lineHeight = node.level >= 2 ? 13 : 16;
    lines.forEach((line, idx) => {
      const tspan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
      tspan.setAttribute("x", x);
      tspan.setAttribute("dy", idx === 0 ? `${-(lines.length - 1) * 0.5}em` : "1.2em");
      tspan.textContent = line;
      text.appendChild(tspan);
    });

    g.append(circle, text);

    g.addEventListener("click", () => {
      const clickingFocused = state.focusedNodeId === node.id;
      if (node.collapsible) {
        if (state.expanded.has(node.id)) {
          state.expanded.delete(node.id);
        } else {
          state.expanded.add(node.id);
        }
      }
      state.focusedNodeId = clickingFocused ? null : node.id;
      render();
    });

    nodeLayer.appendChild(g);
  });
}

resetBtn.addEventListener("click", () => {
  state.focusedNodeId = null;
  state.expanded = new Set(
    GRAPH_DATA.nodes.filter((n) => n.collapsible && n.defaultExpanded).map((n) => n.id)
  );
  render();
});

createLegend();
render();
