import React, { useMemo, useState } from "react";

const starterQuestions = [
  "What is the development pressure in Hyderabad?",
  "Compare Hyderabad and Warangal.",
  "Show evidence about urban expansion.",
  "How do I check a survey number?",
  "What happens if agricultural conversion is restricted?",
  "How can I use BhuDrishti?"
];

export default function AI({ region, question, setQuestion, answer, askAI, navigate, context }) {
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState([]);

  const submit = async () => {
    if (!question.trim()) return;
    setBusy(true);
    try {
      await askAI();
      setHistory(h => [{ q: question.trim(), at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }, ...h].slice(0, 5));
    } finally {
      setBusy(false);
    }
  };

  const evidence = useMemo(() => answer?.evidence || [], [answer]);

  return (
    <section className="page-v4 wide ai-page-v13">
      <div className="page-heading ai-heading-v13">
        <div>
          <p className="eyebrow">04 / AI EVIDENCE ENGINE</p>
          <h1>Ask the land<br/><span>evidence anything.</span></h1>
        </div>
        <p className="page-subtitle">Ask questions in natural language. The assistant routes the question to the platform's regional data, research catalogue, land-record workflow, analytics and policy tools, then shows what evidence was used.</p>
      </div>

      <div className="ai-shell-v13">
        <div className="ai-query-card-v13">
          <div className="ai-query-top-v13">
            <div>
              <span className="ai-live-dot-v13"/> Evidence assistant
              <small>Current region: {context?.parcel?.village || region}{context?.parcel?.surveyNo ? ` · Survey ${context.parcel.surveyNo}` : ""}</small>
            </div>
            <span className="ai-grounded-badge-v13">GROUNDED MODE</span>
          </div>
          <textarea
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") submit(); }}
            placeholder="Ask about land, growth, ownership workflow, research, policy or future development…"
            aria-label="Ask BhuDrishti AI Evidence a question"
          />
          <div className="ai-actions-v13">
            <button className="primary-v4" disabled={busy || !question.trim()} onClick={submit}>{busy ? "Analyzing…" : "Analyze evidence →"}</button>
            <button className="secondary-v4" onClick={() => setQuestion("")}>Clear</button>
            <span>Ctrl/Cmd + Enter to submit</span>
          </div>
        </div>

        <div className="ai-starters-v13">
          <div className="ai-section-label-v13">TRY A QUESTION</div>
          <div className="ai-starter-grid-v13">
            {starterQuestions.map(q => <button key={q} onClick={() => setQuestion(q)}>{q}<span>↗</span></button>)}
          </div>
        </div>

        {answer ? (
          <div className="ai-result-v13">
            <div className="ai-result-main-v13">
              <div className="ai-result-header-v13">
                <div><span className="eyebrow">ANSWER</span><h2>{answer.intent || "Evidence synthesis"}</h2></div>
                <span className={`ai-confidence-v13 ${String(answer.confidence || "").toLowerCase()}`}>{answer.confidence || "Unknown"} confidence</span>
              </div>
              <div className="ai-question-echo-v13">“{answer.q || question}”</div>
              <p className="ai-answer-text-v13">{answer.text}</p>
              <div className="ai-result-actions-v13">
                <button onClick={() => navigate("dashboard")}>Open Analytics →</button>
                <button onClick={() => navigate("research")}>Open Legal Research →</button>
                <button onClick={() => navigate("explore")}>Open Land Map →</button>
              </div>
            </div>
            <aside className="ai-evidence-panel-v13">
              <span className="eyebrow">EVIDENCE USED</span>
              {evidence.length ? evidence.map((item, i) => <div className="ai-evidence-item-v13" key={`${item}-${i}`}><b>{String(i + 1).padStart(2, "0")}</b><span>{item}</span></div>) : <p>No evidence items were returned.</p>}
              <div className="ai-source-v13"><small>SOURCE</small><b>{answer.source || "BhuDrishti evidence engine"}</b><p>{answer.disclaimer || "Prototype decision-support output."}</p></div>
            </aside>
          </div>
        ) : (
          <div className="ai-empty-v13">
            <div className="ai-pulse-v13">✦</div>
            <div><b>Ready for a question</b><p>Start with a regional question, research request, land-record query or policy scenario. The answer will show the detected intent and supporting evidence.</p></div>
          </div>
        )}

        {history.length > 0 && <div className="ai-history-v13"><span className="ai-section-label-v13">THIS SESSION</span>{history.map((h, i) => <button key={`${h.q}-${i}`} onClick={() => setQuestion(h.q)}><span>{h.at}</span>{h.q}</button>)}</div>}
      </div>
    </section>
  );
}
