import tempfile
import unittest
from pathlib import Path

from agent_hub.store import WorkspaceStore


class WorkspaceStoreTest(unittest.TestCase):
    def test_create_list_and_reject_duplicate(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            store = WorkspaceStore(Path(directory) / "agent-hub.db")
            store.initialize()
            created = store.create_workspace("Finance Ops", "Reconciliation agents")

            self.assertEqual(store.list_workspaces(), [created])
            with self.assertRaisesRegex(ValueError, "同名"):
                store.create_workspace("finance ops")


if __name__ == "__main__":
    unittest.main()

