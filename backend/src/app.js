import compression from "compression";
import cors from "cors";
import express from "express";

import { settings } from "./config.js";
import { errorHandler } from "./errors.js";
import { router as adminRouter } from "./routes/admin.js";
import { router as eventsRouter } from "./routes/events.js";
import { router as meRouter } from "./routes/me.js";
import { router as registrationsRouter } from "./routes/registrations.js";
import { router as volunteerRouter } from "./routes/volunteer.js";

export const app = express();

// methods left at cors' default (covers every verb these routes use);
// allowedHeaders left unset so it reflects whatever the browser actually
// requested (Authorization, Content-Type, ...) — the practical equivalent
// of FastAPI's allow_headers=["*"] without hardcoding a header list.
app.use(cors({ origin: settings.CORS_ORIGINS }));
// Several admin endpoints return large JSON (full registration/participant
// lists) — compress anything worth compressing rather than shipping it raw.
app.use(compression({ threshold: 500 }));
app.use(express.json());

app.get("/", (req, res) => res.json({ status: "ok" }));

// Every router is mounted under /api; the frontend's VITE_API_BASE points at it.
app.use("/api/events", eventsRouter);
app.use("/api/registrations", registrationsRouter);
app.use("/api/me", meRouter);
app.use("/api/volunteer", volunteerRouter);
app.use("/api/admin", adminRouter);

// Must be registered last — Express 5 forwards a rejected promise from any
// async route handler above straight here.
app.use(errorHandler);
