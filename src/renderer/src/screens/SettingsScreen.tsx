import { useEffect, useState } from "react";
import type { DbInfoResponse } from "../../../contracts/ipc";

declare global {
  interface Window {
    api: import("../../../contracts/ipc").AppApi;
  }
}

export function SettingsScreen() {
  const [info, setInfo] = useState<DbInfoResponse | null>(null);
  const [status, setStatus] = useState<string>("");

  const refresh = async () => {
    try {
      setInfo(await window.api.dbGetInfo());
    } catch (error) {
      setStatus(`Ошибка загрузки информации о БД: ${String(error)}`);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const onOpen = async () => {
    setStatus("");
    try {
      const out = await window.api.dbChooseOpen();
      if (!out.switched) setStatus("Выбор базы отменён.");
    } catch (error) {
      setStatus(`Ошибка открытия базы: ${String(error)}`);
    }
  };

  const onCreate = async () => {
    setStatus("");
    try {
      const out = await window.api.dbChooseCreate({ defaultName: "bazzza.db" });
      if (!out.switched) setStatus("Создание базы отменено.");
    } catch (error) {
      setStatus(`Ошибка создания базы: ${String(error)}`);
    }
  };

  const onExportCopy = async () => {
    setStatus("");
    try {
      const out = await window.api.dbExportCopy({ defaultName: "bazzza-copy.db" });
      setStatus(`Копия БД сохранена: ${out.path} (${out.writtenBytes} bytes)`);
    } catch (error) {
      setStatus(`Ошибка экспорта копии: ${String(error)}`);
    }
  };

  const onBackupNow = async () => {
    setStatus("");
    try {
      const out = await window.api.dbBackupNow();
      setStatus(`Резервная копия создана: ${out.path} (${out.writtenBytes} bytes)`);
      await refresh();
    } catch (error) {
      setStatus(`Ошибка резервного копирования: ${String(error)}`);
    }
  };

  const onResetDefault = async () => {
    setStatus("");
    try {
      await window.api.dbResetToDefault();
    } catch (error) {
      setStatus(`Ошибка сброса БД: ${String(error)}`);
    }
  };

  return (
    <section>
      <h2>Settings</h2>
      <h3>База данных</h3>
      <p>После выбора базы приложение перезапустится.</p>
      <pre>
        {JSON.stringify(
          {
            dbPath: info?.dbPath ?? "",
            exists: info?.exists ?? false,
            sizeBytes: info?.sizeBytes ?? null,
            lastModified: info?.lastModified ? new Date(info.lastModified).toISOString() : null,
          },
          null,
          2,
        )}
      </pre>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={() => void onOpen()}>
          Открыть базу…
        </button>
        <button type="button" onClick={() => void onCreate()}>
          Создать новую…
        </button>
        <button type="button" onClick={() => void onExportCopy()}>
          Экспорт копии…
        </button>
        <button type="button" onClick={() => void onBackupNow()}>
          Сделать резервную копию
        </button>
        <button type="button" onClick={() => void onResetDefault()}>
          Сбросить на базу по умолчанию
        </button>
      </div>

      {status ? <p>{status}</p> : null}
    </section>
  );
}
