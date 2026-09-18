import compression from "compression";
import cors from "cors";
import express from "express";
import { settings } from "./config/index.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { router as apiRouter } from "./routes/index.js";
export const app = express();
app.set("trust proxy", 1);
app.use(cors({ origin: settings.CORS_ORIGINS }));
app.use(
  compression({
    threshold: 500,
    filter: (req, res) =>
      res.getHeader("Content-Type") !== "text/event-stream" && compression.filter(req, res),
  })
);
app.use(express.json());
app.use("/api", apiRouter);
app.get("/", (req, res) => res.json({ status: "ok" }));
app.use(errorHandler);
// 8100, not 8000: the popular default port is routinely claimed by other
// local processes. App Hosting sets PORT itself, so this only affects dev.
const port = process.env.PORT || 8100;
app.listen(port, () => {
  console.log(`backend -> http://localhost:${port}`);
});
