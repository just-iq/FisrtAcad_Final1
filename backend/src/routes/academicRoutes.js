const express = require("express");
const { listDepartments, listLevels, listGroups } = require("../controllers/academicController");

const academicRouter = express.Router();

// Public route to fetch departments for signup
academicRouter.get("/departments", listDepartments);
academicRouter.get("/levels", listLevels);
academicRouter.get("/groups", listGroups);

module.exports = { academicRouter };
