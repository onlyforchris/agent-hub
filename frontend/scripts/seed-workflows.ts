import { workflowRepository } from "@/agent/workflows/jsonRepository.js";

async function main() {
  await workflowRepository.seedIfEmpty();
  const list = await workflowRepository.list();
  console.log(`[seed] workflows: ${list.length}`);
  for (const item of list) {
    console.log(`  - ${item.id}: ${item.name} (${item.status})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

