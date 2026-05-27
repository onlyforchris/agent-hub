import type { Express, Request, Response } from "express";
import type { WorkflowGraph } from "@/src/types/workflow.js";
import { workflowRepository } from "./jsonRepository.js";

function sendError(res: Response, err: unknown, status = 400) {
  const message = err instanceof Error ? err.message : String(err);
  res.status(status).json({ error: message });
}

export function registerWorkflowRoutes(app: Express) {
  app.get("/api/workflows", async (req, res) => {
    try {
      await workflowRepository.seedIfEmpty();
      const items = await workflowRepository.list({
        status: req.query.status as string | undefined,
        category: req.query.category as string | undefined,
        q: req.query.q as string | undefined,
      });
      res.json(items);
    } catch (e) {
      sendError(res, e);
    }
  });

  app.post("/api/workflows/seed", async (_req, res) => {
    try {
      await workflowRepository.seedIfEmpty();
      const items = await workflowRepository.list();
      res.json({ ok: true, count: items.length });
    } catch (e) {
      sendError(res, e);
    }
  });

  app.post("/api/workflows", async (req, res) => {
    try {
      const record = await workflowRepository.create(req.body);
      res.status(201).json(record);
    } catch (e) {
      sendError(res, e);
    }
  });

  app.get("/api/workflows/:id", async (req, res) => {
    try {
      const record = await workflowRepository.get(req.params.id);
      if (!record) return res.status(404).json({ error: "template not found" });
      res.json(record);
    } catch (e) {
      sendError(res, e);
    }
  });

  app.put("/api/workflows/:id", async (req, res) => {
    try {
      const record = await workflowRepository.update(req.params.id, req.body);
      res.json(record);
    } catch (e) {
      sendError(res, e, e instanceof Error && e.message.includes("not found") ? 404 : 400);
    }
  });

  app.delete("/api/workflows/:id", async (req, res) => {
    try {
      await workflowRepository.delete(req.params.id);
      res.json({ ok: true });
    } catch (e) {
      sendError(res, e);
    }
  });

  app.get("/api/workflows/:id/versions", async (req, res) => {
    try {
      const versions = await workflowRepository.listVersions(req.params.id);
      res.json(versions);
    } catch (e) {
      sendError(res, e);
    }
  });

  app.post("/api/workflows/:id/versions", async (req, res) => {
    try {
      const version = await workflowRepository.createVersion(req.params.id, req.body);
      res.status(201).json(version);
    } catch (e) {
      sendError(res, e);
    }
  });

  app.get("/api/workflows/:id/versions/:vid", async (req, res) => {
    try {
      const version = await workflowRepository.getVersion(req.params.id, req.params.vid);
      if (!version) return res.status(404).json({ error: "version not found" });
      res.json(version);
    } catch (e) {
      sendError(res, e);
    }
  });

  app.put("/api/workflows/:id/versions/:vid/graph", async (req, res) => {
    try {
      const graph = req.body as WorkflowGraph;
      const version = await workflowRepository.saveGraph(req.params.id, req.params.vid, graph);
      res.json(version);
    } catch (e) {
      sendError(res, e);
    }
  });

  app.post("/api/workflows/:id/validate", async (req, res) => {
    try {
      const graph = (req.body?.graph ?? req.body) as WorkflowGraph;
      const result = workflowRepository.validateGraph(graph);
      res.json(result);
    } catch (e) {
      sendError(res, e);
    }
  });

  app.post("/api/workflows/:id/publish", async (req, res) => {
    try {
      const meta = await workflowRepository.publish(req.params.id, req.body);
      res.json(meta);
    } catch (e) {
      sendError(res, e);
    }
  });

  app.post("/api/workflows/:id/unpublish", async (_req, res) => {
    try {
      const meta = await workflowRepository.unpublish(_req.params.id);
      res.json(meta);
    } catch (e) {
      sendError(res, e);
    }
  });

  app.get("/api/workflows/:id/graph", async (req, res) => {
    try {
      const graph = await workflowRepository.getPublishedGraph(req.params.id);
      if (!graph) return res.status(404).json({ error: "no published graph" });
      res.json(graph);
    } catch (e) {
      sendError(res, e);
    }
  });
}

