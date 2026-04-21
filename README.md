# МЛУ-ТБ — интерактивная схема взаимосвязей

Одностраничное веб-приложение на `HTML + CSS + JavaScript` с рендерингом графа в `SVG`.

## Структура проекта

- `index.html` — каркас страницы, заголовок, легенда, контейнер SVG.
- `styles.css` — презентационный стиль схемы, состояния hover/focus/dim.
- `graph-data.js` — данные онтологии (`nodes`, `edges`, `group`, `parent`, `children`, `level`).
- `app.js` — layout, рендер узлов/рёбер, интерактивность (focus, expand/collapse, reset).

## Запуск локально

Откройте `index.html` напрямую в браузере или поднимите простой сервер:

```bash
python3 -m http.server 8000
```

Затем перейдите на http://localhost:8000
