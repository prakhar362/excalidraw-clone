"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_1 = require("./http/server");
const index_1 = require("./ws/index");
(0, server_1.startHttpServer)();
(0, index_1.startWebSocketServer)();
