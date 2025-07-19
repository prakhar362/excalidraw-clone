"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const server_1 = require("./http/server");
const index_1 = require("./ws/index");
dotenv_1.default.config();
const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 5000;
function startServer() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield mongoose_1.default.connect(MONGO_URI);
            console.log('✅ Connected to MongoDB');
            const app = (0, server_1.createExpressApp)();
            const server = http_1.default.createServer(app);
            (0, index_1.attachWebSocketServer)(server);
            server.listen(PORT, () => {
                console.log(`🚀 Server running on http://localhost:${PORT}`);
            });
        }
        catch (err) {
            console.error('❌ Failed to start server:', err);
        }
    });
}
startServer();
