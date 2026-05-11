require("dotenv").config();
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env"), override: true });
const express = require("express");
const cors = require("cors");
const { getSupabase } = require("./lib/supabase");

const ZHIPU_MODEL = (process.env.ZHIPU_MODEL || "glm-4v-flash").trim();
const ZHIPU_API_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";

function getZhipuKey() {
  const key = (process.env.ZHIPU_API_KEY || "").trim();
  if (!key) {
    const err = new Error("智谱 AI 未配置：请在 .env 中设置 ZHIPU_API_KEY");
    err.code = "ZHIPU_NOT_CONFIGURED";
    throw err;
  }
  return key;
}

async function callZhipu(prompt, mimeType, imageData) {
  const key = getZhipuKey();
  const resp = await fetch(ZHIPU_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: ZHIPU_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageData}` } },
          ],
        },
      ],
    }),
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`智谱 API 错误 ${resp.status}: ${errText}`);
  }
  const json = await resp.json();
  return json.choices?.[0]?.message?.content ?? "";
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "15mb" }));

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

app.get("/api/task", async (req, res) => {
  try {
    const supabase = getSupabase();
    const { count, error: countError } = await supabase
      .from("tasks")
      .select("*", { count: "exact", head: true });

    if (countError) {
      console.error(countError);
      return res.status(500).json({ error: "读取任务列表失败", detail: countError.message });
    }
    if (!count) {
      return res.status(404).json({ error: "暂无任务，请先在 tasks 表插入数据" });
    }

    const offset = Math.floor(Math.random() * count);
    const { data, error } = await supabase.from("tasks").select("*").range(offset, offset).maybeSingle();

    if (error) {
      console.error(error);
      return res.status(500).json({ error: "获取随机任务失败", detail: error.message });
    }
    if (!data) {
      return res.status(404).json({ error: "未取到任务" });
    }

    return res.json(data);
  } catch (err) {
    if (err.code === "SUPABASE_NOT_CONFIGURED") {
      return res.status(503).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: err.message || "服务器错误" });
  }
});

app.get("/api/scores", async (req, res) => {
  const rawLimit = Number(req.query.limit);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.floor(rawLimit), 1), 100) : 30;
  try {
    const supabase = getSupabase();
    const { data: rows, error } = await supabase
      .from("scores")
      .select("id, keyword, reason, created_at, task_id")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error(error);
      return res.status(500).json({ error: "读取得分记录失败", detail: error.message });
    }

    const taskIds = [...new Set((rows || []).map((r) => r.task_id).filter((id) => id != null))];
    let taskTitleById = Object.create(null);
    if (taskIds.length > 0) {
      const { data: taskRows, error: taskErr } = await supabase
        .from("tasks")
        .select("id, title")
        .in("id", taskIds);
      if (!taskErr && taskRows) {
        for (const t of taskRows) {
          if (t.id != null) taskTitleById[t.id] = t.title != null ? String(t.title) : null;
        }
      }
    }

    const items = (rows || []).map((row) => ({
      id: row.id,
      keyword: row.keyword,
      reason: row.reason,
      created_at: row.created_at,
      task_id: row.task_id,
      task_title: row.task_id != null ? taskTitleById[row.task_id] ?? null : null,
    }));

    return res.json({ items });
  } catch (err) {
    if (err.code === "SUPABASE_NOT_CONFIGURED") {
      return res.status(503).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: err.message || "服务器错误" });
  }
});

/** 全站累计通关次数（scores 行数） */
app.get("/api/stats", async (req, res) => {
  try {
    const supabase = getSupabase();
    const { count, error } = await supabase.from("scores").select("*", { count: "exact", head: true });

    if (error) {
      console.error(error);
      return res.status(500).json({ error: "读取统计失败", detail: error.message });
    }

    return res.json({ totalMatches: count || 0 });
  } catch (err) {
    if (err.code === "SUPABASE_NOT_CONFIGURED") {
      return res.status(503).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: err.message || "服务器错误" });
  }
});

app.get("/api/leaderboard", async (req, res) => {
  const rawLimit = Number(req.query.limit);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.floor(rawLimit), 1), 50) : 20;
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from("scores").select("keyword").limit(5000);

    if (error) {
      console.error(error);
      return res.status(500).json({ error: "读取排行榜失败", detail: error.message });
    }

    const counts = Object.create(null);
    for (const row of data || []) {
      const k = row.keyword != null ? String(row.keyword) : "";
      if (!k) continue;
      counts[k] = (counts[k] || 0) + 1;
    }

    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([keyword, count]) => ({ keyword, count }));

    return res.json({ items: sorted });
  } catch (err) {
    if (err.code === "SUPABASE_NOT_CONFIGURED") {
      return res.status(503).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: err.message || "服务器错误" });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    zhipu: Boolean((process.env.ZHIPU_API_KEY || "").trim()),
    supabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
  });
});

function parseImageBase64(imageBase64) {
  if (typeof imageBase64 !== "string" || !imageBase64.trim()) {
    return { mimeType: "image/jpeg", data: "" };
  }
  const trimmed = imageBase64.trim();
  const dataUrlMatch = trimmed.match(/^data:([^;]+);base64,(.+)$/s);
  if (dataUrlMatch) {
    return { mimeType: dataUrlMatch[1] || "image/jpeg", data: dataUrlMatch[2] };
  }
  return { mimeType: "image/jpeg", data: trimmed };
}

app.post("/api/identify", async (req, res) => {
  const body = req.body || {};
  const keyword = typeof body.keyword === "string" ? body.keyword.trim() : "";
  const hint = typeof body.hint === "string" ? body.hint.trim() : "";
  const imageBase64 = body.imageBase64;
  const taskId = body.taskId;

  if (!keyword) {
    return res.status(400).json({ error: "缺少或无效的 keyword" });
  }
  if (!imageBase64 || typeof imageBase64 !== "string") {
    return res.status(400).json({ error: "缺少或无效的 imageBase64" });
  }

  const { mimeType, data } = parseImageBase64(imageBase64);
  if (!data) {
    return res.status(400).json({ error: "imageBase64 内容为空" });
  }

  const prompt =
    `你是一个寻宝游戏的裁判，你的任务是帮用户赢得游戏，而不是刁难他们。

用户要用照片表现网络热词：【${keyword}】。提示：【${hint || "无"}】。

【重要规则】你必须判定 match: true，除非照片是纯黑屏/纯白屏/完全模糊看不出任何内容。
只要照片里有任何可见内容（人、物、场景、表情、动作），你都要强行找到与【${keyword}】的联系并通过。

找联系的方法（任选其一即可）：
1. 直接联系：照片内容直接体现了热词
2. 情绪/氛围联系：照片的情绪氛围与热词相符
3. 隐喻联系：照片里的某个元素可以隐喻热词
4. 谐音/形似联系：照片里有与热词谐音或形似的东西
5. 创意解读：用最天马行空的方式解读，让用户觉得自己很有创意

match: true 时：用网络流行语热情夸奖，说出你发现的那个联系，语气要像发现宝藏一样兴奋。
例如："绝了！这个低头的姿势完美诠释了'屁股'——坐姿即正义，打工人的脊梁就是这么弯的！"

只有照片完全黑屏/白屏/模糊到看不出任何内容时才 match: false，并友好提示重拍。

只返回 JSON：{"match": true/false, "reason": "点评内容"}`;

  try {
    const text = await callZhipu(prompt, mimeType, data);

    // 从返回文本中提取 JSON（模型有时会在 JSON 外包裹 markdown）
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(502).json({ error: "模型返回的不是合法 JSON", raw: text });
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return res.status(502).json({ error: "模型返回的不是合法 JSON", raw: text });
    }

    if (parsed && parsed.match === true) {
      try {
        const supabase = getSupabase();
        const row = {
          keyword: String(keyword),
          reason: typeof parsed.reason === "string" ? parsed.reason : null,
        };
        if (taskId && typeof taskId === "string" && UUID_RE.test(taskId.trim())) {
          row.task_id = taskId.trim();
        }
        const { error: insertError } = await supabase.from("scores").insert(row);
        if (insertError) {
          console.error("scores 写入失败:", insertError);
          return res.json({ ...parsed, scoreSaved: false, scoreError: insertError.message });
        }
        return res.json({ ...parsed, scoreSaved: true });
      } catch (e) {
        if (e.code === "SUPABASE_NOT_CONFIGURED") {
          return res.json({ ...parsed, scoreSaved: false, scoreError: e.message });
        }
        console.error(e);
        return res.json({ ...parsed, scoreSaved: false, scoreError: e.message || "写入得分失败" });
      }
    }

    return res.json(parsed);
  } catch (err) {
    if (err.code === "ZHIPU_NOT_CONFIGURED") {
      return res.status(503).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: err.message || "调用智谱 AI 失败" });
  }
});

app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  const key = (process.env.ZHIPU_API_KEY || "").trim();
  console.log("ZHIPU_API_KEY:", key ? `已加载(${key.length} 字符)` : "未加载");
  console.log("ZHIPU_MODEL:", ZHIPU_MODEL);
  console.log(`寻宝后端已启动: http://localhost:${PORT}`);
});
