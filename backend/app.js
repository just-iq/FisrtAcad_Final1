const http = require("http");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const { config } = require("./src/config/config");
const { attachRequestId } = require("./src/middleware/requestId");
const { errorHandler, notFoundHandler } = require("./src/middleware/error");
const { registerRoutes } = require("./src/routes");
const { createSocketServer } = require("./src/sockets");

const app = express();

// Trust proxy so req.ip, secure cookies, and HTTPS deployment behind reverse proxies work correctly.
app.set("trust proxy", 1);

app.use(helmet());
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(attachRequestId);
app.use(morgan("combined"));

app.get("/health", (_req, res) => res.json({ ok: true, service: "firstacad-backend" }));

registerRoutes(app);

app.use(notFoundHandler);
app.use(errorHandler);

const { initScheduler } = require("./src/services/schedulerService");

const server = http.createServer(app);
createSocketServer(server);
initScheduler();

server.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`FirstAcad backend listening on :${config.port}`);
});

