import { createHmac } from "node:crypto";

const secret = process.env.POSTGREST_TEST_JWT_SECRET;
if (!secret) throw new Error("POSTGREST_TEST_JWT_SECRET is required");
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const header = encode({ alg: "HS256", typ: "JWT" });
const payload = encode({ exp: Math.floor(Date.now() / 1000) + 600, role: "service_role" });
const signature = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
process.stdout.write(`${header}.${payload}.${signature}`);
