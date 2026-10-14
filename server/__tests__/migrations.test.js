import { describe, it, expect, beforeAll } from "vitest";

let db, migrate, MIGRATIONS;

beforeAll(async () => {
  process.env.DB_PATH = ":memory:";
  ({ default: db, migrate, MIGRATIONS } = await import("../core/db.js"));
});

describe("数据库版本化迁移（user_version 顺序回放）", () => {
  it("新库：版本推进到最新，关键表全部存在", () => {
    expect(db.pragma("user_version", { simple: true })).toBe(MIGRATIONS.length);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((t) => t.name);
    for (const t of [
      "users",
      "evaluations",
      "quota_counters",
      "jd_keywords",
      "guest_trials",
      "events",
      "feedback",
      "llm_usage",
      "pro_requests",
      "downloads",
    ]) {
      expect(tables).toContain(t);
    }
  });

  it("关键新增列已建好（plan / plan_expires_at / share_hide_name / pay_email）", () => {
    const cols = (t) => db.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name);
    expect(cols("users")).toEqual(
      expect.arrayContaining(["plan", "plan_expires_at", "deleted_at", "purge_after"])
    );
    expect(cols("evaluations")).toEqual(
      expect.arrayContaining(["share_hide_name", "share_expires_at", "objective_json", "revision", "kind"])
    );
    expect(cols("pro_requests")).toContain("pay_email");
  });

  it("幂等：再跑一次 migrate 不抛错、版本不变", () => {
    const before = db.pragma("user_version", { simple: true });
    expect(() => migrate()).not.toThrow();
    expect(db.pragma("user_version", { simple: true })).toBe(before);
  });

  it("迁移编号连续且唯一（v = 1..N）", () => {
    expect(MIGRATIONS.map((m) => m.v)).toEqual(
      Array.from({ length: MIGRATIONS.length }, (_, i) => i + 1)
    );
  });

  it("v15 回填：老 objective_json 补上 qualityScore/matchScore，且与重新评分完全一致", async () => {
    const { evaluateResume, backfillObjectiveScores } = await import("../scoring/index.js");

    const resume = `张三
联系方式：13800138000 邮箱：zhangsan@example.com 城市：杭州
自我评价：3 年前端开发经验，熟悉主流前端技术栈。
教育经历：浙江大学 计算机科学与技术 本科 2019-09 至 2023-06
工作经历：某科技公司 前端开发 2023-07 至 2024-06
- 使用 Vue3 与 TypeScript 重构核心页面，首屏加载时间下降 40%
- 负责 3 个模块
项目经历：简历助手 前端负责人
技能：JavaScript、TypeScript、Vue3、Node.js`;
    const jd = "岗位：社群运营。要求：社群运营、用户增长、活动策划、短视频。";
    const jdKeywords = ["社群运营", "用户增长", "活动策划", "短视频"];

    const fresh = evaluateResume(resume, { jdText: jd, jdKeywords });
    // 模拟拆分上线前落库的记录：没有 qualityScore / matchScore
    const legacy = { ...fresh };
    delete legacy.qualityScore;
    delete legacy.matchScore;
    expect(legacy.score).not.toBe(fresh.qualityScore); // 旧综合分确实不能当质量分用

    const info = db
      .prepare(
        `INSERT INTO evaluations (user_id, resume, job_title, job_description, score, report, objective_json)
         VALUES (1, ?, ?, ?, ?, ?, ?)`
      )
      .run(resume, "社群运营", jd, fresh.score, "【总分】6/10", JSON.stringify(legacy));
    const id = info.lastInsertRowid;

    // 把版本退回到 v14 再跑迁移，模拟"老库升级"
    db.pragma("user_version = 14");
    expect(() => migrate()).not.toThrow();
    expect(db.pragma("user_version", { simple: true })).toBe(MIGRATIONS.length);

    const row = db.prepare("SELECT score, report, objective_json FROM evaluations WHERE id = ?").get(id);
    const after = JSON.parse(row.objective_json);
    expect(after.qualityScore).toBe(fresh.qualityScore);
    expect(after.matchScore).toBe(fresh.matchScore);
    // 回填是"只加字段"：原有内容与列值都不动
    expect(after.dimensions).toEqual(legacy.dimensions);
    expect(after.matchRate).toBe(legacy.matchRate);
    expect(after.score).toBe(legacy.score);
    expect(row.score).toBe(fresh.score);
    expect(row.report).toBe("【总分】6/10");
    // 已是新结构 → 再跑一次无需改动
    expect(backfillObjectiveScores(after)).toBeNull();
  });
});
