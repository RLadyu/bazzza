import os
import re
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
OUTPUT_DIR = BASE_DIR / "Справочник фтизиатрии"

CATEGORIES = [
    "препарат",
    "режим_химиотерапии",
    "диагноз_или_статус",
    "симптом_или_признак",
    "лабораторный_показатель",
    "микробиология",
    "лучевая_диагностика",
    "иммунодиагностика",
    "эндоскопия",
    "процедура",
    "хирургия",
    "нежелательное_явление",
    "административное_событие",
    "раздел_документа",
    "документ",
]

TRANSLIT = {
    "а": "a",
    "б": "b",
    "в": "v",
    "г": "g",
    "д": "d",
    "е": "e",
    "ё": "e",
    "ж": "zh",
    "з": "z",
    "и": "i",
    "й": "i",
    "к": "k",
    "л": "l",
    "м": "m",
    "н": "n",
    "о": "o",
    "п": "p",
    "р": "r",
    "с": "s",
    "т": "t",
    "у": "u",
    "ф": "f",
    "х": "h",
    "ц": "ts",
    "ч": "ch",
    "ш": "sh",
    "щ": "shch",
    "ы": "y",
    "э": "e",
    "ю": "yu",
    "я": "ya",
}


def slugify(text: str) -> str:
    cleaned = re.sub(r"[^0-9A-Za-zА-Яа-я]+", "_", text.strip().lower())
    result = []
    for ch in cleaned:
        if ch in TRANSLIT:
            result.append(TRANSLIT[ch])
        else:
            result.append(ch)
    return re.sub(r"_+", "_", "".join(result)).strip("_")


def make_regex(variants: list[str]) -> list[str]:
    escaped = [re.escape(v) for v in variants if v]
    if not escaped:
        return []
    group = "|".join(sorted(set(escaped), key=len, reverse=True))
    return [
        rf"(?i)\\b({group})\\b",
        rf"(?i)\\b({group})\\b\
?\s*[:=]?\s*([0-9]+(?:[\\.,][0-9]+)?)\s*([A-Za-zА-Яа-я/%]+)?",
    ]


def write_term(term: dict, counter: int) -> str:
    name = term["name"]
    category = term["category"]
    subcategory = term.get("subcategory")
    timeline = term["timeline"]
    synonyms = term.get("synonyms", [])
    abbreviations = term.get("abbreviations", [])
    value_model = term["value_model"]
    patterns = term.get("patterns") or make_regex([name] + synonyms + abbreviations)
    requires_check = term.get("requires_check", True)
    note = term.get("note")
    examples = term.get("examples", [])
    how_written = term.get("how_written", [])
    extract_fields = term.get("extract_fields", [])
    table_rows = term.get("table_rows", [])

    code = term.get("code") or f"{slugify(name)}_{counter}"
    safe_name = name.replace("/", " ").replace("\\", " ").replace(":", " ").strip()
    filename = f"{category} — {safe_name}.md"

    subcategory_value = "null" if not subcategory else f"\"{subcategory}\""
    note_value = "null" if not note else f"\"{note}\""
    lines = [
        "---",
        f"код: \"{code}\"",
        f"название: \"{name}\"",
        f"категория: \"{category}\"",
        f"подкатегория: {subcategory_value}",
        f"синонимы: {synonyms}",
        f"аббревиатуры: {abbreviations}",
        f"шаблоны: {patterns}",
        "модель_значения:",
        f"  тип: \"{value_model.get('type', 'null')}\"",
        f"  единицы: {value_model.get('units', [])}",
        f"  допустимые_значения: {value_model.get('allowed', 'null')}",
        f"  минимум: {value_model.get('min', 'null')}",
        f"  максимум: {value_model.get('max', 'null')}",
        "таймлайн:",
        f"  дорожка: \"{timeline['track']}\"",
        f"  тип: \"{timeline['type']}\"",
        f"  приоритет: {timeline['priority']}",
        f"требует_проверки: {'true' if requires_check else 'false'}",
        f"примечание: {note_value}",
        f"примеры_фраз_из_ИБ: {examples}",
        "---",
        "",
        term.get("summary", "Краткое описание термина для нормализации данных ИБ."),
        "",
        "## Как пишут в ИБ",
    ]
    for item in how_written:
        lines.append(f"- {item}")
    if not how_written:
        lines.append("- пример: отсутствует")
    lines += ["", "## Что извлекать рядом"]
    if extract_fields:
        for field in extract_fields:
            lines.append(f"- {field}")
    else:
        lines.append("- дата")
    lines += ["", "## Типовая таблица"]
    if table_rows:
        for row in table_rows:
            lines.append(f"- {row}")
    else:
        lines.append("- дата | значение | единицы")

    content = "\n".join(lines) + "\n"
    path = OUTPUT_DIR / filename
    path.write_text(content, encoding="utf-8")
    return filename


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    terms: list[dict] = []

    drugs = [
        ("Изониазид", ["INH", "H", "Isoniazid", "ГИД", "изониазид"], ["H"], "мг"),
        ("Рифампицин", ["RIF", "R", "Rifampicin", "рифампин"], ["R"], "мг"),
        ("Пиразинамид", ["PZA", "Z", "Pyrazinamide"], ["Z"], "мг"),
        ("Этамбутол", ["EMB", "E", "Ethambutol"], ["E"], "мг"),
        ("Стрептомицин", ["SM", "S", "Streptomycin"], ["S"], "мг"),
        ("Канамицин", ["KM", "K", "Kanamycin"], ["K"], "мг"),
        ("Амикацин", ["AMK", "Ak", "Amikacin"], ["Am"], "мг"),
        ("Капреомицин", ["Cm", "Capreomycin"], ["Cm"], "мг"),
        ("Левофлоксацин", ["Lfx", "Levofloxacin"], ["Lfx"], "мг"),
        ("Моксифлоксацин", ["Mfx", "Moxifloxacin"], ["Mfx"], "мг"),
        ("Бедаквилин", ["Bdq", "Sirturo", "бедаквилин"], ["Bdq"], "мг"),
        ("Деламанид", ["Dlm", "Delamanid"], ["Dlm"], "мг"),
        ("Линезолид", ["Lzd", "Linezolid"], ["Lzd"], "мг"),
        ("Клофазимин", ["Cfz", "Clofazimine"], ["Cfz"], "мг"),
        ("Циклосерин", ["Cs", "Cycloserine"], ["Cs"], "мг"),
        ("Теризидон", ["Trd", "Terizidone"], ["Trd"], "мг"),
        ("Этионамид", ["Eto", "Ethionamide"], ["Eto"], "мг"),
        ("Протионамид", ["Pto", "Prothionamide"], ["Pto"], "мг"),
        ("Парааминосалициловая кислота", ["ПАСК", "PAS", "Para-aminosalicylic"], ["ПАСК"], "мг"),
        ("Карбапенемы", ["имипенем", "меропенем", "carbapenem"], [], "мг"),
        ("Амоксициллин/клавуланат", ["Аугментин", "Amoxiclav", "AMC"], ["AMC"], "мг"),
        ("Кларитромицин", ["Clr", "Clarithromycin"], ["Clr"], "мг"),
        ("Азитромицин", ["Azi", "Azithromycin"], ["Azi"], "мг"),
        ("Пиридоксин", ["витамин B6", "Pyridoxine"], ["B6"], "мг"),
        ("Преднизолон", ["Pred", "Prednisolone"], ["Pred"], "мг"),
        ("Омепразол", ["Ome", "Omeprazole"], ["Ome"], "мг"),
        ("Парацетамол", ["Acetaminophen", "Paracetamol"], ["Par"], "мг"),
        ("Ибупрофен", ["Ibuprofen", "Ibu"], ["Ibu"], "мг"),
        ("Флуконазол", ["Fluconazole", "Flc"], ["Flc"], "мг"),
        ("Котримоксазол", ["Co-trimoxazole", "Bactrim"], ["CTX"], "мг"),
        ("Эритромицин", ["Ery", "Erythromycin"], ["Ery"], "мг"),
        ("Кеторолак", ["Ketorolac", "Ktr"], ["Ktr"], "мг"),
        ("Морфин", ["Morphine"], ["Mph"], "мг"),
        ("Трамадол", ["Tramadol"], ["Trm"], "мг"),
        ("Лоперамид", ["Loperamide"], ["Lop"], "мг"),
        ("Ондансетрон", ["Ondansetron", "Ond"], ["Ond"], "мг"),
        ("Метоклопрамид", ["Metoclopramide"], ["Mcp"], "мг"),
        ("Фуросемид", ["Furosemide", "Lasix"], ["Fur"], "мг"),
        ("Спиронолактон", ["Spironolactone", "SPL"], ["SPL"], "мг"),
        ("Эналаприл", ["Enalapril", "Enal"], ["Enl"], "мг"),
        ("Лизиноприл", ["Lisinopril", "Lis"], ["Lis"], "мг"),
        ("Метформин", ["Metformin", "Met"], ["Met"], "мг"),
        ("Инсулин", ["Insulin", "инс"], ["Ins"], "ЕД"),
        ("Ацетилсалициловая кислота", ["АСК", "ASA", "аспирин"], ["АСК"], "мг"),
        ("Гепарин", ["Heparin", "UFH"], ["UFH"], "ЕД"),
        ("Эноксапарин", ["Enoxaparin", "Clexane"], ["Eno"], "мг"),
        ("Флутиказон", ["Fluticasone"], ["Flu"], "мкг"),
        ("Сальбутамол", ["Salbutamol", "Ventolin"], ["Sal"], "мкг"),
        ("Будесонид", ["Budesonide"], ["Bud"], "мкг"),
        ("Амброксол", ["Ambroxol", "Lasolvan"], ["Amb"], "мг"),
        ("Ацетилцистеин", ["NAC", "ACC", "Acetylcysteine"], ["NAC"], "мг"),
        ("Дексаметазон", ["Dexamethasone", "Dex"], ["Dex"], "мг"),
        ("Цефтриаксон", ["Ceftriaxone", "Ctr"], ["Ctr"], "мг"),
        ("Цефтазидим", ["Ceftazidime", "Caz"], ["Caz"], "мг"),
        ("Пиперациллин/тазобактам", ["Pip/Tazo", "Tazocin"], ["PTZ"], "мг"),
        ("Колистин", ["Colistin", "Polymyxin E"], ["Col"], "мг"),
        ("Левотироксин", ["Levothyroxine", "LT4"], ["LT4"], "мкг"),
        ("Феназепам", ["Phenazepam"], ["Phz"], "мг"),
        ("Диазепам", ["Diazepam", "Relanium"], ["Dia"], "мг"),
        ("Галоперидол", ["Haloperidol"], ["Hal"], "мг"),
        ("Кветиапин", ["Quetiapine"], ["Que"], "мг"),
        ("Лоратадин", ["Loratadine"], ["Lor"], "мг"),
        ("Цетиризин", ["Cetirizine"], ["Cet"], "мг"),
        ("Лорапамет", ["Lorapamate"], ["Lrp"], "мг"),
    ]

    for name, syns, abbrs, unit in drugs:
        terms.append(
            {
                "name": name,
                "category": "препарат",
                "subcategory": "противотуберкулёзный или поддерживающий",
                "synonyms": syns,
                "abbreviations": abbrs,
                "timeline": {"track": "терапия", "type": "интервал", "priority": 80},
                "value_model": {"type": "строка", "units": [unit], "allowed": "null", "min": "null", "max": "null"},
                "requires_check": True,
                "examples": [
                    f"{name} 600 мг 1 раз/сут",
                    f"Отмена {name}",
                    f"{name} 3 раза в неделю",
                ],
                "summary": "Препарат, встречающийся в схемах лечения туберкулёза или сопутствующей терапии.",
                "how_written": [
                    f"{name} 0-1-0",
                    f"{syns[0]} 600 мг",
                    f"{name} через день",
                    f"Отмена {name}",
                    f"Продолжить {name}",
                ],
                "extract_fields": ["дата", "доза", "единицы", "кратность", "форма", "путь введения"],
                "table_rows": [
                    f"2024-01-10 | {name} | 600 | мг | 1 раз/сут",
                    f"2024-02-01 | {name} | отмена | -",
                ],
            }
        )

    regimens = [
        ("Режим I", ["режим 1", "I режим", "Regimen I"], ["I"], "интервал"),
        ("Режим II", ["режим 2", "II режим"], ["II"], "интервал"),
        ("Режим III", ["режим 3", "III режим"], ["III"], "интервал"),
        ("Режим IV", ["режим 4", "IV режим"], ["IV"], "интервал"),
        ("Режим V", ["режим 5", "V режим"], ["V"], "интервал"),
        ("HRZE", ["H R Z E", "HRZE", "режим HRZE"], [], "интервал"),
        ("HRZES", ["HRZES", "H R Z E S"], [], "интервал"),
        ("BPaL", ["BPaL", "B-Pa-L"], [], "интервал"),
        ("BPaLM", ["BPaLM", "B-Pa-L-M"], [], "интервал"),
        ("Короткий режим МЛУ", ["short regimen MDR", "короткий режим"], [], "интервал"),
        ("Длительный режим МЛУ", ["long regimen MDR", "длительный режим"], [], "интервал"),
        ("Интенсивная фаза", ["интенсивная фаза", "IF"], [], "интервал"),
        ("Фаза продолжения", ["фаза продолжения", "FP"], [], "интервал"),
        ("Пероральный режим", ["oral regimen", "пероральный"], [], "интервал"),
        ("Инъекционный режим", ["injectable regimen", "инъекционный"], [], "интервал"),
        ("Режим Lfx", ["Lfx regimen", "режим с Lfx"], [], "интервал"),
        ("Режим Mfx", ["Mfx regimen", "режим с Mfx"], [], "интервал"),
        ("Режим Bdq", ["Bdq regimen", "режим с бедаквилином"], [], "интервал"),
        ("Режим Dlm", ["Dlm regimen", "режим с деламанидом"], [], "интервал"),
        ("Режим Lzd", ["Lzd regimen", "режим с линезолидом"], [], "интервал"),
        ("Режим Cfz", ["Cfz regimen", "режим с клофазимином"], [], "интервал"),
        ("Режим Cs", ["Cs regimen", "режим с циклосерином"], [], "интервал"),
        ("Режим Eto", ["Eto regimen", "режим с этионамидом"], [], "интервал"),
        ("Режим Pto", ["Pto regimen", "режим с протионамидом"], [], "интервал"),
        ("Режим PAS", ["PAS regimen", "режим с ПАСК"], [], "интервал"),
        ("Режим Z", ["режим с пиразинамидом"], [], "интервал"),
        ("Режим E", ["режим с этамбутолом"], [], "интервал"),
        ("Режим H", ["режим с изониазидом"], [], "интервал"),
        ("Режим R", ["режим с рифампицином"], [], "интервал"),
    ]

    for name, syns, abbrs, ttype in regimens:
        terms.append(
            {
                "name": name,
                "category": "режим_химиотерапии",
                "subcategory": "режим ХТ",
                "synonyms": syns,
                "abbreviations": abbrs,
                "timeline": {"track": "режимы_ХТ", "type": ttype, "priority": 70},
                "value_model": {"type": "строка", "units": [], "allowed": "null", "min": "null", "max": "null"},
                "requires_check": True,
                "examples": [
                    f"Назначен {name}",
                    f"Перевод на {name}",
                    f"Продолжить {name}",
                ],
                "summary": "Обозначение режима или схемы химиотерапии, используемое в ИБ.",
                "how_written": [
                    f"{name} (интенсивная фаза)",
                    f"{syns[0]} 6 мес",
                    f"Смена на {name}",
                    f"{name} пероральный",
                    f"{name} по схеме",
                ],
                "extract_fields": ["дата", "начало", "окончание", "фаза", "примечание"],
                "table_rows": [
                    f"2024-01-10 | {name} | старт",
                    f"2024-02-15 | {name} | продолжение",
                ],
            }
        )

    diagnoses = [
        "Туберкулёз лёгких",
        "Инфильтративный туберкулёз",
        "Диссеминированный туберкулёз",
        "Очаговый туберкулёз",
        "Фиброзно-кавернозный туберкулёз",
        "Кавернозный туберкулёз",
        "Туберкулёз внутригрудных лимфоузлов",
        "Туберкулёз плевры",
        "Туберкулёз костей",
        "Туберкулёз мочеполовой системы",
        "Туберкулёз ЦНС",
        "Туберкулёз кожи",
        "Внелёгочный туберкулёз",
        "Активный туберкулёз",
        "Неактивный туберкулёз",
        "МБТ+",
        "МБТ-",
        "МЛУ-ТБ",
        "Пре-ШЛУ-ТБ",
        "ШЛУ-ТБ",
        "ЛЧ-ТБ",
        "Рецидив туберкулёза",
        "Первичный туберкулёз",
        "Латентная туберкулёзная инфекция",
        "ВИЧ-инфекция",
        "Сахарный диабет",
        "ХОБЛ",
        "Бронхоэктазы",
        "Хронический гепатит",
        "Кахексия",
        "Исход: вылечен",
        "Исход: завершил лечение",
        "Исход: прервал лечение",
        "Исход: потерян для наблюдения",
    ]

    for name in diagnoses:
        terms.append(
            {
                "name": name,
                "category": "диагноз_или_статус",
                "subcategory": "форма/статус",
                "synonyms": [name.lower(), name.upper(), name.replace(" ", "-")],
                "abbreviations": [],
                "timeline": {"track": "диагнозы", "type": "точка", "priority": 60},
                "value_model": {"type": "строка", "units": [], "allowed": "null", "min": "null", "max": "null"},
                "requires_check": True,
                "examples": [
                    f"Диагноз: {name}",
                    f"Статус: {name}",
                    f"{name} подтверждён",
                ],
                "summary": "Диагноз или статус, используемый для классификации состояния пациента.",
                "how_written": [
                    f"{name}",
                    f"Подозрение на {name}",
                    f"История: {name}",
                    f"Уточнить {name}",
                    f"{name} (выписка)",
                ],
                "extract_fields": ["дата", "статус", "локализация", "примечание"],
                "table_rows": [
                    f"2024-01-10 | {name} | установлен",
                    f"2024-02-01 | {name} | уточнение",
                ],
            }
        )

    symptoms = [
        "Кашель",
        "Кровохарканье",
        "Одышка",
        "Боль в груди",
        "Лихорадка",
        "Ночная потливость",
        "Слабость",
        "Потеря веса",
        "Отсутствие аппетита",
        "Головная боль",
        "Озноб",
        "Тахикардия",
        "Бледность кожных покровов",
        "Утомляемость",
        "Свистящее дыхание",
        "Хрипы",
        "Влажные хрипы",
        "Сухие хрипы",
        "Крепитация",
        "Укорочение перкуторного звука",
        "Ослабленное дыхание",
        "Усиленное дыхание",
        "Боль в боку",
        "Снижение сатурации",
        "Гипергидроз",
        "Сонливость",
        "Тошнота",
        "Рвота",
        "Диарея",
        "Запор",
        "Боль в животе",
    ]

    for name in symptoms:
        terms.append(
            {
                "name": name,
                "category": "симптом_или_признак",
                "subcategory": "симптом",
                "synonyms": [name.lower(), name.upper(), name.replace(" ", "-")],
                "abbreviations": [],
                "timeline": {"track": "симптомы", "type": "точка", "priority": 50},
                "value_model": {"type": "строка", "units": [], "allowed": "null", "min": "null", "max": "null"},
                "requires_check": True,
                "examples": [
                    f"Жалобы: {name}",
                    f"Отмечает {name}",
                    f"{name} усилился",
                ],
                "summary": "Симптом или клинический признак, фиксируемый в ИБ.",
                "how_written": [
                    f"{name}",
                    f"Выраженный {name}",
                    f"{name} отсутствует",
                    f"{name} сохраняется",
                    f"Жалобы на {name}",
                ],
                "extract_fields": ["дата", "характер", "интенсивность", "длительность"],
                "table_rows": [
                    f"2024-01-05 | {name} | да",
                    f"2024-01-15 | {name} | нет",
                ],
            }
        )

    lab_analytes = [
        ("Гемоглобин", ["Hb", "HGB", "гемоглобин"], ["Hb"], ["г/л"]),
        ("Эритроциты", ["RBC", "эр"], ["RBC"], ["10^12/л"]),
        ("Лейкоциты", ["WBC", "лейкоц"], ["WBC"], ["10^9/л"]),
        ("Нейтрофилы", ["NEU", "нейтр"], ["NEU"], ["10^9/л", "%"]),
        ("Лимфоциты", ["LYM", "лимф"], ["LYM"], ["10^9/л", "%"]),
        ("Моноциты", ["MON", "моноц"], ["MON"], ["10^9/л", "%"]),
        ("Эозинофилы", ["EOS", "эоз"], ["EOS"], ["10^9/л", "%"]),
        ("Базофилы", ["BAS", "баз"], ["BAS"], ["10^9/л", "%"]),
        ("Тромбоциты", ["PLT", "тромб"], ["PLT"], ["10^9/л"]),
        ("Гематокрит", ["HCT", "гематокрит"], ["HCT"], ["%"]),
        ("СОЭ", ["ESR", "скорость оседания эритроцитов"], ["ESR"], ["мм/ч"]),
        ("АЛТ", ["ALT", "АлАТ"], ["ALT"], ["Ед/л"]),
        ("АСТ", ["AST", "АсАТ"], ["AST"], ["Ед/л"]),
        ("Билирубин общий", ["общий билирубин", "TBil"], ["TBil"], ["мкмоль/л"]),
        ("Билирубин прямой", ["прямой билирубин", "DBil"], ["DBil"], ["мкмоль/л"]),
        ("Щелочная фосфатаза", ["ЩФ", "ALP"], ["ALP"], ["Ед/л"]),
        ("ГГТ", ["GGT", "гамма-глутамилтрансфераза"], ["GGT"], ["Ед/л"]),
        ("Креатинин", ["Cr", "Creatinine"], ["Cr"], ["мкмоль/л"]),
        ("Мочевина", ["Urea", "мочевина"], ["Urea"], ["ммоль/л"]),
        ("Глюкоза", ["Glucose", "глюк"], ["Glu"], ["ммоль/л"]),
        ("Общий белок", ["TP", "total protein"], ["TP"], ["г/л"]),
        ("Альбумин", ["Alb", "альб"], ["Alb"], ["г/л"]),
        ("С-реактивный белок", ["CRP", "С-реакт"], ["CRP"], ["мг/л"]),
        ("Натрий", ["Na", "натрий"], ["Na"], ["ммоль/л"]),
        ("Калий", ["K", "калий"], ["K"], ["ммоль/л"]),
        ("Хлориды", ["Cl", "хлор"], ["Cl"], ["ммоль/л"]),
        ("Кальций", ["Ca", "кальций"], ["Ca"], ["ммоль/л"]),
        ("Магний", ["Mg", "магний"], ["Mg"], ["ммоль/л"]),
        ("Фосфор", ["P", "фосфор"], ["P"], ["ммоль/л"]),
        ("МНО", ["INR", "международное нормализованное отношение"], ["INR"], []),
        ("АЧТВ", ["APTT", "аЧТВ"], ["APTT"], ["с"]),
        ("Фибриноген", ["FIB", "фибриноген"], ["FIB"], ["г/л"]),
        ("Д-димер", ["D-dimer", "DD"], ["DD"], ["нг/мл"]),
        ("pH крови", ["pH", "кислотность"], ["pH"], []),
        ("Лактат", ["Lactate", "лактат"], ["Lac"], ["ммоль/л"]),
        ("Бикарбонат", ["HCO3", "бикарбонат"], ["HCO3"], ["ммоль/л"]),
        ("PaO2", ["PaO2", "pO2"], ["PaO2"], ["мм рт.ст."]),
        ("PaCO2", ["PaCO2", "pCO2"], ["PaCO2"], ["мм рт.ст."]),
        ("Белок в моче", ["protein urine", "протеинурия"], ["Prot"], ["г/л"]),
        ("Эритроциты в моче", ["RBC urine", "эритроциты мочи"], ["RBC"], ["в поле зрения"]),
        ("Лейкоциты в моче", ["WBC urine", "лейкоциты мочи"], ["WBC"], ["в поле зрения"]),
        ("Глюкоза в моче", ["glucose urine", "глюкозурия"], ["Glu"], ["ммоль/л"]),
        ("Кетоновые тела", ["ketone", "кетоны"], ["Ket"], ["ммоль/л"]),
        ("Уробилиноген", ["urobilinogen", "уробилиноген"], ["Uro"], ["мг/л"]),
        ("Билирубин в моче", ["bilirubin urine", "билирубинурия"], ["Bil"], ["мг/л"]),
        ("Плотность мочи", ["SG", "удельный вес"], ["SG"], []),
        ("Цилиндры гиалиновые", ["hyaline casts", "гиалиновые"], ["HC"], ["в поле зрения"]),
        ("Цилиндры зернистые", ["granular casts", "зернистые"], ["GC"], ["в поле зрения"]),
    ]

    for name, syns, abbrs, units in lab_analytes:
        terms.append(
            {
                "name": name,
                "category": "лабораторный_показатель",
                "subcategory": "лаборатория",
                "synonyms": syns,
                "abbreviations": abbrs,
                "timeline": {"track": "лаборатория", "type": "ряд", "priority": 40},
                "value_model": {"type": "число", "units": units, "allowed": "null", "min": "null", "max": "null"},
                "requires_check": True,
                "examples": [
                    f"{name}: 12.3 {units[0] if units else ''}".strip(),
                    f"{syns[0]} 4,5 {units[0] if units else ''}".strip(),
                    f"{name} = 8.1",
                ],
                "summary": "Лабораторный показатель, встречающийся в анализах крови или мочи.",
                "how_written": [
                    f"{name} 12,5 {units[0] if units else ''}".strip(),
                    f"{syns[0]}: 8.1",
                    f"{name} 6.0",
                    f"{name} (контроль)",
                    f"{name} повышен",
                ],
                "extract_fields": ["дата", "значение", "единицы", "метод", "комментарий"],
                "table_rows": [
                    f"2024-01-20 | {name} | 12.3 | {units[0] if units else ''}".strip(),
                    f"2024-02-02 | {name} | 8.1 | {units[0] if units else ''}".strip(),
                ],
            }
        )

    micro_terms = [
        ("Мазок на КУМ", ["КУМ", "мазок", "AFB smear"], ["AFB"], ["отриц", "1+", "2+", "3+"]),
        ("Микроскопия мазка", ["микроскопия", "smear microscopy"], [], ["отриц", "полож"]),
        ("Посев на МБТ", ["посев", "culture"], [], ["рост", "нет роста"]),
        ("Посев MGIT", ["MGIT", "BACTEC"], ["MGIT"], ["рост", "нет роста"]),
        ("Посев на Лёвенштейна-Йенсена", ["LJ", "LJ medium"], ["LJ"], ["рост", "нет роста"]),
        ("Xpert MTB/RIF", ["Xpert", "GeneXpert", "MTB/RIF"], ["Xpert"], ["обнаружено", "не обнаружено"]),
        ("Xpert MTB/RIF Ultra", ["Ultra", "Xpert Ultra"], ["Ultra"], ["обнаружено", "не обнаружено"]),
        ("ПЦР МБТ", ["PCR", "ПЦР", "ДНК МБТ"], ["PCR"], ["обнаружено", "не обнаружено"]),
        ("Лекарственная чувствительность", ["DST", "drug susceptibility"], ["DST"], ["чувствителен", "устойчив"]),
        ("Резистентность к рифампицину", ["RIF resistant", "Rif resistance"], ["RIF"], ["есть", "нет"]),
        ("Резистентность к изониазиду", ["INH resistant", "H resistance"], ["INH"], ["есть", "нет"]),
        ("Резистентность к фторхинолонам", ["FQ resistant", "fluoroquinolone"], ["FQ"], ["есть", "нет"]),
        ("Резистентность к аминогликозидам", ["AG resistant", "aminoglycoside"], ["AG"], ["есть", "нет"]),
        ("МБТ в мокроте", ["МТБ", "MBT", "MTB"], ["MTB"], ["полож", "отриц"]),
        ("МБТ в бронхоальвеолярном лаваже", ["МБТ в БАЛ", "MTB BAL"], ["BAL"], ["полож", "отриц"]),
    ]

    for name, syns, abbrs, allowed in micro_terms:
        terms.append(
            {
                "name": name,
                "category": "микробиология",
                "subcategory": "микробиология",
                "synonyms": syns,
                "abbreviations": abbrs,
                "timeline": {"track": "микробиология", "type": "точка", "priority": 55},
                "value_model": {"type": "категория", "units": [], "allowed": allowed, "min": "null", "max": "null"},
                "requires_check": True,
                "examples": [
                    f"{name}: {allowed[0]}",
                    f"{syns[0]} — {allowed[-1]}",
                    f"{name} ({allowed[0]})",
                ],
                "summary": "Микробиологический или молекулярный тест, используемый для выявления МБТ.",
                "how_written": [
                    f"{name} {allowed[0]}",
                    f"{syns[0]} {allowed[-1]}",
                    f"{name} результат: {allowed[0]}",
                    f"{name} отрицательно",
                    f"{name} положительно",
                ],
                "extract_fields": ["дата", "результат", "материал", "метод"],
                "table_rows": [
                    f"2024-01-12 | {name} | {allowed[0]}",
                    f"2024-02-03 | {name} | {allowed[-1]}",
                ],
            }
        )

    immuno = [
        ("Проба Манту", ["Манту", "PPD", "tuberculin skin test"], ["TST"], ["полож", "отриц", "сомнит"]),
        ("Диаскинтест", ["Diaskintest", "Диаскин"], ["DST"], ["полож", "отриц", "сомнит"]),
        ("IGRA", ["IGRA", "Quantiferon", "T-SPOT"], ["IGRA"], ["полож", "отриц", "сомнит"]),
    ]

    for name, syns, abbrs, allowed in immuno:
        terms.append(
            {
                "name": name,
                "category": "иммунодиагностика",
                "subcategory": "иммунодиагностика",
                "synonyms": syns,
                "abbreviations": abbrs,
                "timeline": {"track": "иммунодиагностика", "type": "точка", "priority": 45},
                "value_model": {"type": "категория", "units": [], "allowed": allowed, "min": "null", "max": "null"},
                "requires_check": True,
                "examples": [
                    f"{name} {allowed[0]}",
                    f"{syns[0]}: {allowed[-1]}",
                    f"{name} результат {allowed[1]}",
                ],
                "summary": "Иммунологический тест для оценки ответа на антигены МБТ.",
                "how_written": [
                    f"{name} {allowed[0]}",
                    f"{name} {allowed[-1]}",
                    f"{syns[0]} {allowed[1]}",
                    f"{name} сомнительно",
                    f"{name} отрицательно",
                ],
                "extract_fields": ["дата", "результат", "размер папулы", "комментарий"],
                "table_rows": [
                    f"2024-03-01 | {name} | {allowed[0]}",
                    f"2024-03-10 | {name} | {allowed[-1]}",
                ],
            }
        )

    radiology = [
        "Рентгенография ОГК",
        "КТ ОГК",
        "МСКТ грудной клетки",
        "МРТ грудной клетки",
        "УЗИ плевральных полостей",
        "Флюорография",
        "Каверна",
        "Инфильтрация",
        "Очаги",
        "Диссеминация",
        "Плевральный выпот",
        "Утолщение плевры",
        "Фиброз",
        "Кальцинаты",
        "Ателектаз",
        "Бронхоэктазы (КТ)",
        "Очаг Гона",
        "Кольцевидная тень",
        "Полость распада",
        "Милиарная диссеминация",
        "Интерстициальные изменения",
        "Буллы",
        "Склероз",
        "Увеличение лимфоузлов",
        "Смещение средостения",
        "Нодуль",
        "Гидропневмоторакс",
        "Пневмоторакс",
        "Консолидация",
        "Сегментарные изменения",
        "Локальное затемнение",
        "Линейные тени",
        "Двусторонний процесс",
        "Односторонний процесс",
        "Свежие очаги",
        "Старые очаги",
        "Рубцовые изменения",
        "Контрольная КТ",
        "Динамика без изменений",
    ]

    for name in radiology:
        terms.append(
            {
                "name": name,
                "category": "лучевая_диагностика",
                "subcategory": "исследование или находка",
                "synonyms": [name.lower(), name.upper(), name.replace(" ", "-")],
                "abbreviations": [],
                "timeline": {"track": "лучевая", "type": "документ", "priority": 48},
                "value_model": {"type": "строка", "units": [], "allowed": "null", "min": "null", "max": "null"},
                "requires_check": True,
                "examples": [
                    f"Заключение: {name}",
                    f"КТ: {name}",
                    f"На рентгене: {name}",
                ],
                "summary": "Лучевое исследование или описательный термин, встречающийся в протоколах.",
                "how_written": [
                    f"{name}",
                    f"Выявлено: {name}",
                    f"{name} в S1",
                    f"{name} справа",
                    f"{name} без динамики",
                ],
                "extract_fields": ["дата", "локализация", "сторона", "динамика"],
                "table_rows": [
                    f"2024-01-18 | {name} | справа",
                    f"2024-02-20 | {name} | без динамики",
                ],
            }
        )

    endoscopy = [
        "Бронхоскопия",
        "Фибробронхоскопия",
        "Ригидная бронхоскопия",
        "Диагностическая бронхоскопия",
        "Бронхоальвеолярный лаваж",
        "Бронхиальный лаваж",
        "Щёточная биопсия",
        "Щипковая биопсия",
        "Трансбронхиальная биопсия",
        "Эндобронхиальная биопсия",
        "Аспирация секрета",
        "Санация бронхов",
        "Гемостаз эндоскопический",
        "Стентирование бронха",
        "Пункция бронха",
        "Эндобронхиальное УЗИ",
        "Бронхоскопия с БАЛ",
        "Бронхоскопия с биопсией",
        "Бронхоскопия контрольная",
    ]

    for name in endoscopy:
        terms.append(
            {
                "name": name,
                "category": "эндоскопия",
                "subcategory": "эндоскопическая процедура",
                "synonyms": [name.lower(), name.upper(), name.replace(" ", "-")],
                "abbreviations": ["ФБС"] if "Фибро" in name else [],
                "timeline": {"track": "эндоскопия", "type": "точка", "priority": 46},
                "value_model": {"type": "строка", "units": [], "allowed": "null", "min": "null", "max": "null"},
                "requires_check": True,
                "examples": [
                    f"Выполнена {name}",
                    f"Протокол: {name}",
                    f"{name} без осложнений",
                ],
                "summary": "Эндоскопическое исследование или манипуляция в дыхательных путях.",
                "how_written": [
                    f"{name}",
                    f"{name} (материал: БАЛ)",
                    f"{name} слева",
                    f"{name} проведена",
                    f"{name} результат",
                ],
                "extract_fields": ["дата", "локализация", "материал", "результат"],
                "table_rows": [
                    f"2024-01-25 | {name} | выполнена",
                    f"2024-02-14 | {name} | материал БАЛ",
                ],
            }
        )

    procedures = [
        "Торакоцентез",
        "Плевральная пункция",
        "Дренирование плевральной полости",
        "Пункция лимфоузла",
        "Пункция лёгкого",
        "Биопсия плевры",
        "Биопсия лимфоузла",
        "Катетеризация центральной вены",
        "Внутривенная инфузия",
        "Внутримышечная инъекция",
        "Кислородотерапия",
        "Ингаляционная терапия",
        "Небулайзерная терапия",
        "Плевродез",
    ]

    for name in procedures:
        terms.append(
            {
                "name": name,
                "category": "процедура",
                "subcategory": "процедуры",
                "synonyms": [name.lower(), name.upper(), name.replace(" ", "-")],
                "abbreviations": [],
                "timeline": {"track": "процедуры", "type": "точка", "priority": 44},
                "value_model": {"type": "строка", "units": [], "allowed": "null", "min": "null", "max": "null"},
                "requires_check": True,
                "examples": [
                    f"Проведён {name}",
                    f"Назначен {name}",
                    f"{name} выполнен",
                ],
                "summary": "Медицинская процедура вне эндоскопии.",
                "how_written": [
                    f"{name}",
                    f"{name} справа",
                    f"{name} под УЗ-контролем",
                    f"{name} выполнен",
                    f"{name} повторно",
                ],
                "extract_fields": ["дата", "локализация", "объём", "результат"],
                "table_rows": [
                    f"2024-01-30 | {name} | 500 мл",
                    f"2024-02-15 | {name} | без осложнений",
                ],
            }
        )

    surgeries = [
        "Сегментэктомия",
        "Лобэктомия",
        "Пневмонэктомия",
        "Билобэктомия",
        "Клиновидная резекция",
        "Атипичная резекция",
        "Плеврэктомия",
        "Декортикация",
        "Кавернотомия",
        "Кавернэктомия",
        "Торакопластика",
        "ВАТС",
        "Торакоскопия",
        "Плевродез хирургический",
        "Ревизия плевральной полости",
        "Операция на бронхе",
        "Резекция верхней доли",
        "Резекция нижней доли",
        "Санация плевральной полости",
        "Осложнение: послеоперационное кровотечение",
        "Осложнение: бронхоплевральный свищ",
        "Осложнение: инфекция раны",
    ]

    for name in surgeries:
        terms.append(
            {
                "name": name,
                "category": "хирургия",
                "subcategory": "операция",
                "synonyms": [name.lower(), name.upper(), name.replace(" ", "-")],
                "abbreviations": ["VATS"] if name == "ВАТС" else [],
                "timeline": {"track": "хирургия", "type": "точка", "priority": 47},
                "value_model": {"type": "строка", "units": [], "allowed": "null", "min": "null", "max": "null"},
                "requires_check": True,
                "examples": [
                    f"Выполнена {name}",
                    f"Операция: {name}",
                    f"{name} без осложнений",
                ],
                "summary": "Хирургическое вмешательство или связанный термин.",
                "how_written": [
                    f"{name}",
                    f"{name} справа",
                    f"{name} планируется",
                    f"{name} выполнена",
                    f"{name} послеоперационно",
                ],
                "extract_fields": ["дата", "сторона", "доступ", "осложнения"],
                "table_rows": [
                    f"2024-02-01 | {name} | выполнена",
                    f"2024-02-10 | {name} | осложнений нет",
                ],
            }
        )

    adverse = [
        "Удлинение QT",
        "Удлинение QTc",
        "Гепатотоксичность",
        "Нейропатия",
        "Миелосупрессия",
        "Лейкопения",
        "Тромбоцитопения",
        "Анемия",
        "Тошнота",
        "Рвота",
        "Диарея",
        "Боль в животе",
        "Кожная сыпь",
        "Зуд",
        "Аллергическая реакция",
        "Гипергликемия",
        "Гипогликемия",
        "Гипокалиемия",
        "Гипонатриемия",
        "Ототоксичность",
        "Нефротоксичность",
        "Психические нарушения",
        "Депрессия",
        "Тревога",
        "Бессонница",
        "Головокружение",
        "Обморок",
        "Боль в суставах",
        "Мышечная слабость",
        "Повышение АЛТ",
        "Повышение АСТ",
        "Повышение билирубина",
    ]

    for name in adverse:
        terms.append(
            {
                "name": name,
                "category": "нежелательное_явление",
                "subcategory": "НЯ",
                "synonyms": [name.lower(), name.upper(), name.replace(" ", "-")],
                "abbreviations": ["QT"] if "QT" in name else [],
                "timeline": {"track": "НЯ", "type": "точка", "priority": 52},
                "value_model": {"type": "строка", "units": [], "allowed": "null", "min": "null", "max": "null"},
                "requires_check": True,
                "examples": [
                    f"НЯ: {name}",
                    f"Отмечено {name}",
                    f"{name} подозревается",
                ],
                "summary": "Нежелательное явление или побочный эффект, фиксируемый в ИБ.",
                "how_written": [
                    f"{name}",
                    f"{name} 2 степени",
                    f"{name} сохраняется",
                    f"{name} уменьшилось",
                    f"{name} без динамики",
                ],
                "extract_fields": ["дата", "степень", "связь с препаратом", "действия"],
                "table_rows": [
                    f"2024-02-05 | {name} | 1 степень",
                    f"2024-02-12 | {name} | регресс",
                ],
            }
        )

    admin_events = [
        "Госпитализация",
        "Перевод в отделение",
        "Выписка",
        "Начало лечения",
        "Окончание лечения",
        "Перерыв в лечении",
        "Пропуск доз",
        "Возобновление лечения",
        "Смена схемы",
        "Консилиум",
        "Направление",
        "Согласие пациента",
        "Отказ от лечения",
        "Постановка на учет",
        "Снятие с учета",
        "Контрольный визит",
    ]

    for name in admin_events:
        terms.append(
            {
                "name": name,
                "category": "административное_событие",
                "subcategory": "админ",
                "synonyms": [name.lower(), name.upper(), name.replace(" ", "-")],
                "abbreviations": [],
                "timeline": {"track": "админ", "type": "точка", "priority": 30},
                "value_model": {"type": "строка", "units": [], "allowed": "null", "min": "null", "max": "null"},
                "requires_check": True,
                "examples": [
                    f"{name}",
                    f"Событие: {name}",
                    f"{name} запланирована",
                ],
                "summary": "Административное событие или этап маршрутизации пациента.",
                "how_written": [
                    f"{name}",
                    f"{name} сегодня",
                    f"{name} отменена",
                    f"{name} завершена",
                    f"{name} перенос",
                ],
                "extract_fields": ["дата", "причина", "решение"],
                "table_rows": [
                    f"2024-01-02 | {name} | выполнено",
                    f"2024-02-22 | {name} | план",
                ],
            }
        )

    doc_sections = [
        "Анамнез",
        "Объективно",
        "Назначения",
        "Эпикриз",
        "Заключение КТ",
        "Протокол бронхоскопии",
        "Операционный протокол",
        "Дневник врача",
        "Жалобы",
        "Результаты анализов",
        "План лечения",
        "Рекомендации",
        "Диагноз основной",
        "Диагноз сопутствующий",
        "Согласие",
        "Осмотр",
        "Справка",
        "Протокол консультации",
    ]

    for name in doc_sections:
        terms.append(
            {
                "name": name,
                "category": "раздел_документа",
                "subcategory": "раздел",
                "synonyms": [name.lower(), name.upper(), name.replace(" ", "-")],
                "abbreviations": [],
                "timeline": {"track": "документы", "type": "документ", "priority": 20},
                "value_model": {"type": "строка", "units": [], "allowed": "null", "min": "null", "max": "null"},
                "requires_check": True,
                "examples": [
                    f"{name}:",
                    f"Раздел {name}",
                    f"{name} (документ)",
                ],
                "summary": "Раздел медицинского документа, используемый для структурирования текста.",
                "how_written": [
                    f"{name}:",
                    f"{name} (кратко)",
                    f"{name} -",
                    f"{name} (основной)",
                    f"{name} /",
                ],
                "extract_fields": ["дата", "автор", "содержимое"],
                "table_rows": [
                    f"2024-01-11 | {name} | раздел",
                    f"2024-02-05 | {name} | обновление",
                ],
            }
        )

    documents = [
        "Выписка",
        "История болезни",
        "Протокол консилиума",
        "Результаты лаборатории",
        "Протокол КТ",
        "Протокол рентгенографии",
        "Протокол операции",
        "Электрокардиограмма",
        "Лист назначений",
        "Согласие на лечение",
    ]

    for name in documents:
        terms.append(
            {
                "name": name,
                "category": "документ",
                "subcategory": "документ",
                "synonyms": [name.lower(), name.upper(), name.replace(" ", "-")],
                "abbreviations": [],
                "timeline": {"track": "документы", "type": "документ", "priority": 18},
                "value_model": {"type": "строка", "units": [], "allowed": "null", "min": "null", "max": "null"},
                "requires_check": True,
                "examples": [
                    f"Документ: {name}",
                    f"{name} от 01.01.2024",
                    f"{name} приложена",
                ],
                "summary": "Отдельный документ или тип документа, используемый в ИБ.",
                "how_written": [
                    f"{name}",
                    f"{name} (скан)",
                    f"{name} приложен",
                    f"{name} подписан",
                    f"{name} загружен",
                ],
                "extract_fields": ["дата", "название", "автор", "примечание"],
                "table_rows": [
                    f"2024-01-01 | {name} | есть",
                    f"2024-02-01 | {name} | обновление",
                ],
            }
        )

    filenames = []
    for idx, term in enumerate(terms, start=1):
        filenames.append(write_term(term, idx))

    index_path = OUTPUT_DIR / "ИНДЕКС — справочник фтизиатрии.md"
    index_lines = [
        "# ИНДЕКС — справочник фтизиатрии",
        "",
        "## Категории",
    ]

    for category in CATEGORIES:
        index_lines.append(f"- {category}")
    index_lines.append("")

    for category in CATEGORIES:
        index_lines.append(f"## {category}")
        for filename in sorted([f for f in filenames if f.startswith(f"{category} — ")]):
            term_name = filename.replace(f"{category} — ", "").replace(".md", "")
            index_lines.append(f"- [[{filename}|{term_name}]]")
        index_lines.append("")

    index_lines += [
        "## Памятка для парсинга",
        "- Ищите совпадения по полю `синонимы` и `шаблоны` (regex).",
        "- При совпадении нормализуйте факт в `название` и `код`.",
        "- Используйте `модель_значения` для извлечения чисел, категорий или строк.",
        "- `таймлайн` задаёт дорожку и тип визуализации.",
        "- В спорных случаях учитывайте поле `требует_проверки`.",
        "",
        "## Проверки качества",
        "- Нет дубликатов `код`.",
        "- Синонимы по возможности не конфликтуют (неоднозначности отмечены в примечаниях).",
        "- У каждого термина есть минимум 2 regex-шаблона.",
        "- У каждого термина заполнен `таймлайн`.",
    ]

    index_path.write_text("\n".join(index_lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
