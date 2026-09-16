import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export default async function handler(req, res) {
  const password = req.headers["x-app-password"];

  if (!password || password !== process.env.APP_PASSWORD) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  if (req.method === "GET") {
    const tasks = (await redis.get("tasks")) || [];
    res.status(200).json({ tasks });
    return;
  }

  if (req.method === "POST") {
    const { tasks } = req.body || {};
    await redis.set("tasks", tasks || []);
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ error: "method not allowed" });
}
