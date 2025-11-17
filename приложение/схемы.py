"""Pydantic-схемы для базовых представлений пациентов и схем лечения."""

from pydantic import BaseModel


class СхемаПациентКратко(BaseModel):
    """Краткое представление пациента для ответов API."""

    идентификатор: int
    код_пациента: str
    возраст_лет: int | None = None
    пол: str | None = None
    центр: str | None = None

    class Config:
        orm_mode = True


class СхемаЛеченияКратко(BaseModel):
    """Краткое представление схемы химиотерапии."""

    идентификатор: int
    название: str
    группа_лечения: str | None = None
    плановая_длительность_месяцев: int | None = None

    class Config:
        orm_mode = True
