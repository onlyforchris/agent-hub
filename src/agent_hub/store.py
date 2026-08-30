from __future__ import annotations

import sqlite3
from contextlib import closing
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4


class WorkspaceStore:
    def __init__(self, database: Path):
        self.database = database

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.database)
        connection.row_factory = sqlite3.Row
        return connection

    def initialize(self) -> None:
        self.database.parent.mkdir(parents=True, exist_ok=True)
        with closing(self._connect()) as connection, connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS workspaces (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL COLLATE NOCASE UNIQUE,
                    description TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL
                )
                """
            )

    def create_workspace(self, name: str, description: str = "") -> dict[str, str]:
        name = name.strip()
        description = description.strip()
        if not 1 <= len(name) <= 80:
            raise ValueError("工作区名称须为 1–80 个字符")
        if len(description) > 500:
            raise ValueError("描述不能超过 500 个字符")

        workspace = {
            "id": uuid4().hex,
            "name": name,
            "description": description,
            "created_at": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        }
        try:
            with closing(self._connect()) as connection, connection:
                connection.execute(
                    "INSERT INTO workspaces (id, name, description, created_at) VALUES (:id, :name, :description, :created_at)",
                    workspace,
                )
        except sqlite3.IntegrityError:
            raise ValueError("同名工作区已存在") from None
        return workspace

    def list_workspaces(self) -> list[dict[str, str]]:
        with closing(self._connect()) as connection, connection:
            rows = connection.execute(
                "SELECT id, name, description, created_at FROM workspaces ORDER BY created_at DESC"
            ).fetchall()
        return [dict(row) for row in rows]
