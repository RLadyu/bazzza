"""Определения моделей базы данных для исследования лечения лекарственно-устойчивого туберкулёза."""

from sqlalchemy import Column, Integer, String, Text, Boolean, Float, Date, ForeignKey
from sqlalchemy.orm import relationship

from .база_данных import База


class ГруппаЛечения(База):
    """Группа лечения: короткий или длительный режим."""

    __tablename__ = "группы_лечения"

    идентификатор = Column(Integer, primary_key=True, index=True)
    название = Column(String, nullable=False)

    схемы_лечения = relationship("СхемаХимиотерапии", back_populates="группа_лечения", cascade="all, delete-orphan")


class СхемаХимиотерапии(База):
    """Конкретная схема химиотерапии с указанием группы и длительности."""

    __tablename__ = "схемы_химиотерапии"

    идентификатор = Column(Integer, primary_key=True, index=True)
    группа_лечения_id = Column(Integer, ForeignKey("группы_лечения.идентификатор"), nullable=False)
    название = Column(String, nullable=False)
    плановая_длительность_месяцев = Column(Integer, nullable=False)
    описание = Column(Text)

    группа_лечения = relationship("ГруппаЛечения", back_populates="схемы_лечения")
    препараты_в_схеме = relationship("ПрепаратВСхеме", back_populates="схема_химиотерапии", cascade="all, delete-orphan")
    курсы_лечения = relationship("КурсЛечения", back_populates="схема_химиотерапии")


class ПрепаратВСхеме(База):
    """Состав схемы химиотерапии с дозировками и путём введения."""

    __tablename__ = "препараты_в_схеме"

    идентификатор = Column(Integer, primary_key=True, index=True)
    схема_химиотерапии_id = Column(Integer, ForeignKey("схемы_химиотерапии.идентификатор"), nullable=False)
    название_препарата = Column(String, nullable=False)
    суточная_доза_мг = Column(Float)
    кратность = Column(String)
    путь_введения = Column(String)

    схема_химиотерапии = relationship("СхемаХимиотерапии", back_populates="препараты_в_схеме")


class Пациент(База):
    """Исходные данные по пациенту с лекарственно-устойчивым туберкулёзом."""

    __tablename__ = "пациенты"

    идентификатор = Column(Integer, primary_key=True, index=True)
    код_пациента = Column(String, unique=True, nullable=False)
    центр = Column(String)
    возраст_лет = Column(Integer)
    пол = Column(String)
    рост_см = Column(Float)
    вес_кг = Column(Float)
    индекс_массы_тела = Column(Float)
    сопутствующие_заболевания = Column(Text)
    форма_туберкулёза = Column(String)
    есть_каверны = Column(Boolean, default=False)
    двустороннее_поражение = Column(Boolean, default=False)
    тип_лекарственной_устойчивости = Column(String)
    описание_дст = Column(Text)

    курсы_лечения = relationship("КурсЛечения", back_populates="пациент", cascade="all, delete-orphan")


class КурсЛечения(База):
    """Курс лечения пациента с привязкой к схеме химиотерапии."""

    __tablename__ = "курсы_лечения"

    идентификатор = Column(Integer, primary_key=True, index=True)
    пациент_id = Column(Integer, ForeignKey("пациенты.идентификатор"), nullable=False)
    схема_химиотерапии_id = Column(Integer, ForeignKey("схемы_химиотерапии.идентификатор"), nullable=False)
    дата_начала = Column(Date)
    дата_окончания = Column(Date)
    плановая_длительность_месяцев = Column(Integer)
    фактическая_длительность_месяцев = Column(Integer)
    включён_в_mitt = Column(Boolean, default=False)
    включён_в_pp = Column(Boolean, default=False)

    пациент = relationship("Пациент", back_populates="курсы_лечения")
    схема_химиотерапии = relationship("СхемаХимиотерапии", back_populates="курсы_лечения")
    лечение_по_месяцам = relationship("ЛечениеПоМесяцам", back_populates="курс_лечения", cascade="all, delete-orphan")
    микробиология = relationship("Микробиология", back_populates="курс_лечения", cascade="all, delete-orphan")
    инструментальные_исследования = relationship("ИнструментальноеИсследование", back_populates="курс_лечения", cascade="all, delete-orphan")
    лабораторные_результаты = relationship("ЛабораторныйРезультат", back_populates="курс_лечения", cascade="all, delete-orphan")
    экг_записи = relationship("ЭКГЗапись", back_populates="курс_лечения", cascade="all, delete-orphan")
    осмотры_специалистов = relationship("ОсмотрСпециалиста", back_populates="курс_лечения", cascade="all, delete-orphan")
    нежелательные_явления = relationship("НежелательноеЯвление", back_populates="курс_лечения", cascade="all, delete-orphan")
    исход_лечения = relationship("ИсходЛечения", back_populates="курс_лечения", uselist=False, cascade="all, delete-orphan")
    расчётные_показатели = relationship("РасчётныеПоказатели", back_populates="курс_лечения", uselist=False, cascade="all, delete-orphan")


class ЛечениеПоМесяцам(База):
    """Данные о выполнении лечения по каждому месяцу курса."""

    __tablename__ = "лечение_по_месяцам"

    идентификатор = Column(Integer, primary_key=True, index=True)
    курс_лечения_id = Column(Integer, ForeignKey("курсы_лечения.идентификатор"), nullable=False)
    месяц_от_начала = Column(Integer, nullable=False)
    план_доз_за_месяц = Column(Integer)
    факт_доз_за_месяц = Column(Integer)
    были_изменения_схемы = Column(Boolean, default=False)
    описание_изменений = Column(Text)

    курс_лечения = relationship("КурсЛечения", back_populates="лечение_по_месяцам")


class Микробиология(База):
    """Результаты микробиологических исследований по ключевым этапам."""

    __tablename__ = "микробиология"

    идентификатор = Column(Integer, primary_key=True, index=True)
    курс_лечения_id = Column(Integer, ForeignKey("курсы_лечения.идентификатор"), nullable=False)
    этап = Column(String)
    дата_исследования = Column(Date)
    результат_мазка = Column(String)
    результат_посева = Column(String)
    описание_дст = Column(Text)

    курс_лечения = relationship("КурсЛечения", back_populates="микробиология")


class ИнструментальноеИсследование(База):
    """Рентгенологические и томографические исследования."""

    __tablename__ = "инструментальные_исследования"

    идентификатор = Column(Integer, primary_key=True, index=True)
    курс_лечения_id = Column(Integer, ForeignKey("курсы_лечения.идентификатор"), nullable=False)
    этап = Column(String)
    дата_исследования = Column(Date)
    вид_исследования = Column(String)
    объём_поражения = Column(String)
    есть_каверны = Column(Boolean, default=False)
    максимальный_размер_каверны_мм = Column(Float)
    комментарий = Column(Text)

    курс_лечения = relationship("КурсЛечения", back_populates="инструментальные_исследования")


class ЛабораторныйРезультат(База):
    """Результаты лабораторных исследований (ОАК, биохимия, ОАМ)."""

    __tablename__ = "лабораторные_результаты"

    идентификатор = Column(Integer, primary_key=True, index=True)
    курс_лечения_id = Column(Integer, ForeignKey("курсы_лечения.идентификатор"), nullable=False)
    источник = Column(String)
    этап = Column(String)
    дата_исследования = Column(Date)
    название_параметра = Column(String, nullable=False)
    значение = Column(String)
    единица_измерения = Column(String)

    курс_лечения = relationship("КурсЛечения", back_populates="лабораторные_результаты")


class ЭКГЗапись(База):
    """Показатели ЭКГ до и в ходе лечения."""

    __tablename__ = "экг"

    идентификатор = Column(Integer, primary_key=True, index=True)
    курс_лечения_id = Column(Integer, ForeignKey("курсы_лечения.идентификатор"), nullable=False)
    этап = Column(String)
    дата_исследования = Column(Date)
    qt_мс = Column(Float)
    qtc_мс = Column(Float)
    ритм = Column(String)
    комментарий = Column(Text)

    курс_лечения = relationship("КурсЛечения", back_populates="экг_записи")


class ОсмотрСпециалиста(База):
    """Записи консультаций профильных специалистов."""

    __tablename__ = "осмотры_специалистов"

    идентификатор = Column(Integer, primary_key=True, index=True)
    курс_лечения_id = Column(Integer, ForeignKey("курсы_лечения.идентификатор"), nullable=False)
    дата_осмотра = Column(Date)
    тип_специалиста = Column(String)
    заключение = Column(Text)

    курс_лечения = relationship("КурсЛечения", back_populates="осмотры_специалистов")


class НежелательноеЯвление(База):
    """Информация о нежелательных явлениях, связанных с лечением."""

    __tablename__ = "нежелательные_явления"

    идентификатор = Column(Integer, primary_key=True, index=True)
    курс_лечения_id = Column(Integer, ForeignKey("курсы_лечения.идентификатор"), nullable=False)
    дата_явления = Column(Date)
    месяц_от_начала = Column(Integer)
    тип_явления = Column(String)
    степень = Column(Integer)
    серьёзное = Column(Boolean, default=False)
    связанные_препараты = Column(String)
    принятые_меры = Column(String)
    исход_явления = Column(String)

    курс_лечения = relationship("КурсЛечения", back_populates="нежелательные_явления")


class ИсходЛечения(База):
    """Итог курса лечения и наблюдение после завершения."""

    __tablename__ = "исходы_лечения"

    курс_лечения_id = Column(Integer, ForeignKey("курсы_лечения.идентификатор"), primary_key=True)
    итог_лечения = Column(String)
    дата_итога = Column(Date)
    статус_через_6_месяцев = Column(String)
    дата_6_месяцев = Column(Date)
    статус_через_12_месяцев = Column(String)
    дата_12_месяцев = Column(Date)

    курс_лечения = relationship("КурсЛечения", back_populates="исход_лечения")


class РасчётныеПоказатели(База):
    """Расчётные индикаторы эффективности и безопасности (заглушка)."""

    __tablename__ = "расчётные_показатели"

    курс_лечения_id = Column(Integer, ForeignKey("курсы_лечения.идентификатор"), primary_key=True)
    показатель_1 = Column(Float)
    показатель_2 = Column(Float)
    показатель_3 = Column(Boolean)
    показатель_4 = Column(Boolean)

    курс_лечения = relationship("КурсЛечения", back_populates="расчётные_показатели")
