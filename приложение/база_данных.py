"""Модуль соединения с базой данных SQLite и создания фабрики сессий."""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from .настройки import путь_к_базе_данных

# Создание движка базы данных SQLite
строка_подключения = f"sqlite:///{путь_к_базе_данных}"
движок = create_engine(строка_подключения, connect_args={"check_same_thread": False})

# Фабрика сессий
Сессия = sessionmaker(autocommit=False, autoflush=False, bind=движок)

# Базовый класс для моделей
База = declarative_base()

def получить_сессию():
    """Зависимость FastAPI для предоставления сессии базы данных."""
    сессия = Сессия()
    try:
        yield сессия
    finally:
        сессия.close()
