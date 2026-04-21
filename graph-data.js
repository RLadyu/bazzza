const GROUP_COLORS = {
  core: "#1f4e96",
  resistance: "#d55a3a",
  treatment: "#7c5ad8",
  meds: "#5d68d9",
  risks: "#d79a2f",
  control: "#2491a8",
  diagnostics: "#2f9a60"
};

const LEGEND = [
  { group: "core", label: "Центральный узел" },
  { group: "resistance", label: "ТЛЧ / устойчивость" },
  { group: "treatment", label: "Режимы лечения" },
  { group: "meds", label: "Препараты" },
  { group: "risks", label: "Риски / НЯ" },
  { group: "control", label: "Контроль + кратность" },
  { group: "diagnostics", label: "Обследования" }
];

const NODES = [
  { id: "mld_tb", label: "МЛУ-ТБ", group: "core", level: 0 },

  { id: "resistance", label: "ТЛЧ / устойчивость", group: "resistance", level: 1, parent: "mld_tb", collapsible: true, defaultExpanded: false },
  { id: "h", label: "H", group: "resistance", level: 2, parent: "resistance" },
  { id: "r", label: "R", group: "resistance", level: 2, parent: "resistance" },
  { id: "fq_res", label: "Fq", group: "resistance", level: 2, parent: "resistance" },

  { id: "regimens", label: "режимы лечения", group: "treatment", level: 1, parent: "mld_tb", collapsible: true, defaultExpanded: true },
  { id: "reg_6", label: "6 мес", group: "treatment", level: 2, parent: "regimens" },
  { id: "reg_bpalm", label: "BPaLM", group: "treatment", level: 2, parent: "regimens" },
  { id: "reg_9", label: "9 мес", group: "treatment", level: 2, parent: "regimens" },
  { id: "reg_18_20", label: "18–20 мес", group: "treatment", level: 2, parent: "regimens" },

  { id: "drugs", label: "препараты", group: "meds", level: 1, parent: "mld_tb", collapsible: true, defaultExpanded: false },
  { id: "drug_bdq", label: "Bdq", group: "meds", level: 2, parent: "drugs" },
  { id: "drug_lzd", label: "Lzd", group: "meds", level: 2, parent: "drugs" },
  { id: "drug_lfx", label: "Lfx", group: "meds", level: 2, parent: "drugs" },
  { id: "drug_mfx", label: "Mfx", group: "meds", level: 2, parent: "drugs" },
  { id: "drug_dlm", label: "Dlm", group: "meds", level: 2, parent: "drugs" },
  { id: "drug_cfz", label: "Cfz", group: "meds", level: 2, parent: "drugs" },
  { id: "drug_pa", label: "Pa", group: "meds", level: 2, parent: "drugs" },
  { id: "drug_cs", label: "Cs/Trd", group: "meds", level: 2, parent: "drugs" },
  { id: "drug_z", label: "Z", group: "meds", level: 2, parent: "drugs" },
  { id: "drug_e", label: "E", group: "meds", level: 2, parent: "drugs" },
  { id: "drug_pas", label: "PAS", group: "meds", level: 2, parent: "drugs" },
  { id: "drug_pto", label: "Pto/Eto", group: "meds", level: 2, parent: "drugs" },

  { id: "risks", label: "риски / НЯ", group: "risks", level: 1, parent: "mld_tb", collapsible: true, defaultExpanded: false },
  { id: "risk_qtc", label: "QTc", group: "risks", level: 2, parent: "risks" },
  { id: "risk_myelo", label: "миелотоксичность", group: "risks", level: 2, parent: "risks" },
  { id: "risk_neuro", label: "нейротоксичность", group: "risks", level: 2, parent: "risks" },
  { id: "risk_hepato", label: "гепатотоксичность", group: "risks", level: 2, parent: "risks" },
  { id: "risk_periph", label: "периферич.\nнейропатия", group: "risks", level: 2, parent: "risks" },
  { id: "risk_optic", label: "неврит\nзрительного нерва", group: "risks", level: 2, parent: "risks" },
  { id: "risk_psy", label: "психоневро-\nлогические реакции", group: "risks", level: 2, parent: "risks" },
  { id: "risk_electro", label: "электролитные\nнарушения", group: "risks", level: 2, parent: "risks" },
  { id: "risk_gi", label: "ЖКТ реакции", group: "risks", level: 2, parent: "risks" },
  { id: "risk_endo", label: "эндокринные\nнарушения", group: "risks", level: 2, parent: "risks" },

  { id: "control", label: "контроль", group: "control", level: 1, parent: "mld_tb", collapsible: true, defaultExpanded: false },
  { id: "ctrl_ecg", label: "ЭКГ", group: "control", level: 2, parent: "control" },
  { id: "freq_ecg", label: "до старта, 2 нед,\nдалее ежемесячно", group: "control", level: 3, parent: "ctrl_ecg" },
  { id: "ctrl_oak", label: "ОАК", group: "control", level: 2, parent: "control" },
  { id: "freq_oak", label: "еженедельно 1 мес,\nдалее ежемесячно", group: "control", level: 3, parent: "ctrl_oak" },
  { id: "ctrl_lft", label: "АЛТ/АСТ/билирубин", group: "control", level: 2, parent: "control" },
  { id: "freq_lft", label: "каждые 2–4 нед", group: "control", level: 3, parent: "ctrl_lft" },
  { id: "ctrl_creat", label: "креатинин", group: "control", level: 2, parent: "control" },
  { id: "ctrl_kmgca", label: "K/Mg/Ca", group: "control", level: 2, parent: "control" },
  { id: "freq_kmgca", label: "еженедельно\nпри QT-риске", group: "control", level: 3, parent: "ctrl_kmgca" },
  { id: "ctrl_tsh", label: "ТТГ", group: "control", level: 2, parent: "control" },
  { id: "ctrl_neuro", label: "осмотр\nневролога", group: "control", level: 2, parent: "control" },
  { id: "freq_neuro", label: "ежемесячно", group: "control", level: 3, parent: "ctrl_neuro" },
  { id: "ctrl_opht", label: "офтальмолог", group: "control", level: 2, parent: "control" },
  { id: "freq_opht", label: "каждые 1–3 мес", group: "control", level: 3, parent: "ctrl_opht" },
  { id: "ctrl_audio", label: "аудиометрия", group: "control", level: 2, parent: "control" },

  { id: "diagnostics", label: "обследования", group: "diagnostics", level: 1, parent: "mld_tb", collapsible: true, defaultExpanded: true },
  { id: "diag_smear", label: "микроскопия\nмокроты", group: "diagnostics", level: 2, parent: "diagnostics" },
  { id: "diag_culture", label: "посев", group: "diagnostics", level: 2, parent: "diagnostics" },
  { id: "diag_pcr", label: "ПЦР", group: "diagnostics", level: 2, parent: "diagnostics" },
  { id: "diag_ct", label: "КТ / рентген", group: "diagnostics", level: 2, parent: "diagnostics" },
  { id: "diag_cbc", label: "общий анализ\nкрови", group: "diagnostics", level: 2, parent: "diagnostics" },
  { id: "diag_biochem", label: "биохимия\nкрови", group: "diagnostics", level: 2, parent: "diagnostics" },
  { id: "diag_electro", label: "электролиты", group: "diagnostics", level: 2, parent: "diagnostics" },
  { id: "diag_ecg", label: "ЭКГ", group: "diagnostics", level: 2, parent: "diagnostics" }
];

const HIERARCHY_EDGES = NODES.filter((n) => n.parent).map((n) => ({ source: n.parent, target: n.id, type: "hierarchy" }));

const SEMANTIC_EDGES = [
  ["mld_tb", "h"], ["mld_tb", "r"], ["mld_tb", "regimens"], ["mld_tb", "diagnostics"],
  ["regimens", "drugs"], ["regimens", "fq_res"],
  ["reg_bpalm", "drug_bdq"], ["reg_bpalm", "drug_pa"], ["reg_bpalm", "drug_lzd"], ["reg_bpalm", "drug_mfx"],
  ["reg_6", "drug_bdq"], ["reg_6", "drug_lzd"], ["reg_6", "drug_mfx"], ["reg_6", "drug_cfz"],
  ["reg_9", "drug_lfx"], ["reg_9", "drug_cfz"], ["reg_9", "drug_cs"], ["reg_9", "drug_z"],
  ["reg_18_20", "drug_lfx"], ["reg_18_20", "drug_cs"], ["reg_18_20", "drug_e"], ["reg_18_20", "drug_pas"], ["reg_18_20", "drug_pto"],

  ["drug_bdq", "risk_qtc"], ["drug_bdq", "risk_electro"],
  ["drug_lzd", "risk_myelo"], ["drug_lzd", "risk_periph"], ["drug_lzd", "risk_optic"], ["drug_lzd", "risk_neuro"],
  ["drug_cfz", "risk_qtc"], ["drug_cs", "risk_psy"], ["drug_cs", "risk_neuro"],
  ["drug_dlm", "risk_qtc"], ["drug_mfx", "risk_qtc"], ["drug_lfx", "risk_qtc"],
  ["drug_pa", "risk_hepato"], ["drug_pa", "risk_gi"],
  ["drug_z", "risk_hepato"], ["drug_z", "risk_gi"],
  ["drug_pto", "risk_hepato"], ["drug_pto", "risk_psy"], ["drug_pto", "risk_gi"], ["drug_pto", "risk_endo"],
  ["drug_pas", "risk_hepato"], ["drug_pas", "risk_gi"], ["drug_pas", "risk_endo"],
  ["drug_e", "risk_optic"],

  ["risk_qtc", "ctrl_ecg"], ["risk_myelo", "ctrl_oak"], ["risk_neuro", "ctrl_neuro"], ["risk_hepato", "ctrl_lft"],
  ["risk_hepato", "ctrl_creat"], ["risk_periph", "ctrl_neuro"], ["risk_optic", "ctrl_opht"], ["risk_psy", "ctrl_neuro"],
  ["risk_electro", "ctrl_kmgca"], ["risk_electro", "ctrl_ecg"],
  ["risk_gi", "ctrl_lft"], ["risk_gi", "ctrl_creat"], ["risk_endo", "ctrl_tsh"],

  ["ctrl_ecg", "diag_ecg"], ["ctrl_oak", "diag_cbc"], ["ctrl_lft", "diag_biochem"], ["ctrl_kmgca", "diag_electro"]
].map(([source, target]) => ({ source, target, type: "semantic" }));

const GRAPH_DATA = { nodes: NODES, edges: [...HIERARCHY_EDGES, ...SEMANTIC_EDGES] };
