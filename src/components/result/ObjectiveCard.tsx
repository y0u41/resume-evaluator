import type { ObjectiveScore } from "../../lib/report/report";

export default function ObjectiveCard({
  objective,
  llmScore,
}: {
  objective?: ObjectiveScore | null;
  llmScore?: number | null;
}) {
  if (!objective) return null;
  const rate =
    typeof objective.matchRate === "number" ? Math.round(objective.matchRate * 100) : null;
  const missing = objective.missing || [];
  // 语义拆分（2026-10-09，实测驱动）：旧的单一 score 把"简历写得好不好"与"跟岗位配不配"混在一起，
  // 导致与岗位零匹配的简历也能拿 ~60 分。现在左为「简历质量」、右为「岗位匹配度」。
  const quality =
    typeof objective.qualityScore === "number" ? objective.qualityScore : objective.score;
  const match = typeof objective.matchScore === "number" ? Math.round(objective.matchScore) : rate;
  // 方向性分歧：只在"结论方向相反"时提示。旧逻辑用固定 20 分阈值，低匹配场景必然触发，成了噪音。
  const disagree =
    llmScore != null &&
    match !== null &&
    ((llmScore >= 7 && match < 20) || (llmScore <= 4 && match > 60));

  return (
    <div className="card">
      <h2 className="section-title">
        <span className="section-icon">📐</span>
        客观评分（算法）
      </h2>

      <div className="objective-summary">
        <div
          className={`score-badge ${
            quality >= 80 ? "score-high" : quality >= 60 ? "score-mid" : "score-low"
          }`}
        >
          {quality}
          <small>/ 100</small>
        </div>
        {match !== null && (
          <div className="objective-rate">
            <div className="match-rate-label">
              <span>岗位匹配度</span>
              <span>{match}%</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ ["--target-width" as string]: `${match}%` }} />
            </div>
          </div>
        )}
      </div>

      <p className="hint" style={{ marginTop: 0, marginBottom: 10 }}>
        左为<b>简历质量</b>（完整性 / 格式规范 / 量化成果，与岗位无关），右为<b>岗位匹配度</b>（简历对 JD 关键词的覆盖）。
      </p>

      <div className="objective-dims">
        {objective.dimensions.map((d) => (
          <div className="objective-dim" key={d.name}>
            <div className="objective-dim-head">
              <span>{d.label}</span>
              <span>
                {d.score} 分 · 权重 {Math.round(d.weight * 100)}%
              </span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ ["--target-width" as string]: `${d.score}%` }} />
            </div>
            <div className="objective-dim-reason">{d.reason}</div>
          </div>
        ))}
      </div>

      {missing.length > 0 && (
        <div className="objective-missing">
          <div className="objective-missing-title">缺失关键词（{missing.length}）</div>
          <div className="chips">
            {missing.slice(0, 20).map((k) => (
              <span key={k.canonical} className="chip chip-miss">
                {k.canonical}
              </span>
            ))}
          </div>
        </div>
      )}

      {objective.ats && (
        <div className="objective-missing">
          <div className="objective-missing-title">
            ATS 可解析性 · {objective.ats.score}/100（简历能否被机器正确解析）
          </div>
          <div className="ats-checks">
            {objective.ats.checks.map((c) => (
              <div key={c.key} className={`ats-check ats-${c.status}`}>
                <span className="ats-icon">
                  {c.status === "ok" ? "✅" : c.status === "fail" ? "❌" : "⚠️"}
                </span>
                <span className="ats-label">{c.label}</span>
                <span className="ats-detail">{c.detail}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="hint">
        以上数字由内置算法确定性计算、可复现（同一份简历每次结果相同），与上方 AI 报告相互印证。
      </p>
      {disagree && (
        <p className="hint" style={{ marginTop: 6 }}>
          注意方向性差异：AI 给 {llmScore}/10，而岗位匹配度是 {match}% —— 两者结论方向相反。
          建议先对照上方「缺失关键词」补齐，再让 AI 复评一次，以确认这是"简历写的问题"还是"岗位选的问题"。
        </p>
      )}
    </div>
  );
}
