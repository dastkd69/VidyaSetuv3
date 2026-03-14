/* app.js — VidyaSetu React SPA
   API endpoints:
     GET    /api/chat/list
     POST   /api/chat/create       (FormData: student_name, class_level?, subject?)
     DELETE /api/chat/:id
     POST   /api/analyze           (FormData: chat_id, file)

   Expected /api/analyze response shape:
   {
     total_wrong_answers: number,
     total_recommendations: number,
     processing_time: number,
     recommendations: [{
       topic, confidence, wrong_answer, correction,
       book, class_num, chapter, pages, start_page,
       pdf_url?
     }]
   }
*/

const { createRoot } = ReactDOM;
const { useState, useEffect, useRef, useCallback } = React;

const API_BASE = "/api";

// ─── Helpers ────────────────────────────────────────────────────────────────

function escapeHTML(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

function slugify(str) {
  if (!str) return "unknown";
  return String(str).toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function formatFileSize(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + " " + units[i];
}

// ─── TTS helpers (module-level so they don't reset on re-render) ─────────────

let _ttsActive = false;

function stopTTS() {
  window.speechSynthesis?.cancel();
  _ttsActive = false;
  document.querySelectorAll(".bubble-tts-btn.tts-active").forEach(b =>
    b.classList.remove("tts-active")
  );
}

// ─── TutorModal ─────────────────────────────────────────────────────────────

const TutorModal = ({ topic, card, studentCtx, onClose }) => {
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bodyRef = useRef(null);
  const inputRef = useRef(null);

  // Build opener on first open
  useEffect(() => {
    if (!card) return;
    const name = studentCtx?.student_name || "the student";
    const opener =
      `Hi! Let's work through <strong>${card.topic}</strong> together.\n\n` +
      `<span class="opener-label">❌ What ${name} wrote:</span>\n<em>${escapeHTML(card.wrong_answer)}</em>\n\n` +
      `<span class="opener-label">✅ Correct approach:</span>\n${escapeHTML(card.correction)}\n\n` +
      `Would you like me to walk through the full step-by-step solution, or do you have a specific question?`;

    setHistory([{ role: "assistant", html: opener, text: card.correction }]);
  }, [card]);

  useEffect(() => {
    if (bodyRef.current)
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [history, loading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setLoading(true);

    const userEntry = { role: "user", html: escapeHTML(text), text };
    const apiHistory = [...history.map(m => ({ role: m.role, content: m.text })), { role: "user", content: text }];

    setHistory(prev => [...prev, userEntry]);

    try {
      const systemPrompt =
        `You are VidyaSetu's AI Tutor helping ${studentCtx?.student_name || "a student"} ` +
        `in Class ${studentCtx?.class_level || "10"} with NCERT ${studentCtx?.subject || "Mathematics"}.\n\n` +
        `Current topic: "${topic}".\n` +
        `Student's mistake: ${card?.wrong_answer || ""}\n` +
        `Correct answer: ${card?.correction || ""}\n\n` +
        `Be warm, encouraging, and use numbered steps when solving. ` +
        `Keep each reply under 120 words. Plain text only — no markdown headers.`;

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 350,
          system: systemPrompt,
          messages: apiHistory,
        }),
      });

      const data = await res.json();
      const reply = data.content?.[0]?.text || "I'm having trouble responding. Please try again.";

      setHistory(prev => [...prev, { role: "assistant", html: escapeHTML(reply), text: reply }]);
    } catch (err) {
      console.error("AI Tutor error:", err);
      setHistory(prev => [
        ...prev,
        { role: "assistant", html: "Sorry — couldn't reach the AI service. Check your connection.", text: "" },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, history, loading, topic, card, studentCtx]);

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const handleTTS = (e) => {
    const btn = e.currentTarget;
    const bubble = btn.closest(".tutor-bubble-wrap")?.querySelector(".tutor-bubble");
    const text = bubble?.innerText?.trim();
    if (!text) return;

    const isActive = btn.classList.contains("tts-active");
    stopTTS();
    if (isActive) return;

    btn.classList.add("tts-active");
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.93; utt.pitch = 1; utt.lang = "en-IN";
    utt.onend = utt.onerror = () => { btn.classList.remove("tts-active"); };
    window.speechSynthesis.speak(utt);
  };

  return (
    <div className="modal-backdrop active" onClick={(e) => { if (e.target === e.currentTarget) { stopTTS(); onClose(); } }}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-header-left">
            <div className="modal-title-row">
              <div className="modal-ai-dot"></div>
              <div className="modal-title">AI Tutor</div>
            </div>
            <div className="modal-topic-label">{topic}</div>
          </div>
          <button className="modal-close" onClick={() => { stopTTS(); onClose(); }}>×</button>
        </div>

        <div className="modal-body" ref={bodyRef}>
          {history.map((msg, i) => (
            <div key={i} className={`tutor-message ${msg.role}`}>
              <div className="tutor-avatar">
                {msg.role === "assistant" ? "M" : (studentCtx?.student_name?.charAt(0) || "U")}
              </div>
              <div className="tutor-bubble-wrap">
                <div className="tutor-bubble" dangerouslySetInnerHTML={{ __html: msg.html }} />
                {msg.role === "assistant" && (
                  <button className="bubble-tts-btn" onClick={handleTTS} title="Read aloud">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="tutor-message assistant">
              <div className="tutor-avatar">M</div>
              <div className="tutor-bubble-wrap">
                <div className="tutor-bubble">
                  <div className="typing-indicator"><span/><span/><span/></div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <textarea
            className="modal-input"
            ref={inputRef}
            rows={1}
            placeholder="Ask a question about this topic…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            disabled={loading}
          />
          <button className="modal-send-btn" onClick={sendMessage} disabled={loading || !input.trim()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── RecommendationCard ──────────────────────────────────────────────────────

const RecommendationCard = ({ card, studentCtx }) => {
  const [tutorOpen, setTutorOpen] = useState(false);
  const [feedback, setFeedback] = useState(null); // null | 'up' | 'down' | 'done'
  const [hadConversation, setHadConversation] = useState(false);

  const slug = slugify(card.topic);
  const pdfUrl = card.pdf_url
    ? `${card.pdf_url}#page=${card.start_page || 1}`
    : "#";

  const handleTutorClose = () => {
    setTutorOpen(false);
    if (hadConversation && !feedback) setFeedback("show");
  };

  const handleTutorOpen = () => {
    setHadConversation(false); // reset — TutorModal tracks internally via message count
    setTutorOpen(true);
  };

  // We detect "had conversation" by letting TutorModal call back;
  // simpler: show feedback row after any close if modal was opened.
  const handleTutorCloseWithFlag = () => {
    setTutorOpen(false);
    if (feedback === null) setFeedback("show");
  };

  const submitFeedback = (vote) => {
    setFeedback(vote);
    // Non-critical log
    fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: card.topic, vote, timestamp: new Date().toISOString() }),
    }).catch(() => {});
  };

  return (
    <>
      <div className="recommendation-card" id={`card-${slug}`}>
        <div className="recommendation-header">
          <div className="recommendation-topic">{card.topic}</div>
          {card.confidence && (
            <div className="confidence-badge">{card.confidence}</div>
          )}
        </div>

        <div className="wrong-answer">❌ {card.wrong_answer}</div>

        <div className="recommendation-details">
          {card.book && (
            <div className="detail-row">
              <span className="detail-label">Book:</span>
              <span className="detail-value">{card.book}</span>
            </div>
          )}
          {card.class_num && (
            <div className="detail-row">
              <span className="detail-label">Class:</span>
              <span className="detail-value">{card.class_num}</span>
            </div>
          )}
          {card.chapter && (
            <div className="detail-row">
              <span className="detail-label">Chapter:</span>
              <span className="detail-value">{card.chapter}</span>
            </div>
          )}
          {card.pages && (
            <div className="detail-row">
              <span className="detail-label">Pages:</span>
              {card.pdf_url ? (
                <span
                  className="detail-value page-link"
                  onClick={() => window.open(pdfUrl, "_blank", "noopener,noreferrer")}
                  title="Open textbook PDF"
                >
                  {card.pages}
                </span>
              ) : (
                <span className="detail-value">{card.pages}</span>
              )}
            </div>
          )}
        </div>

        <div className="card-footer">
          <button className="card-tutor-btn" onClick={handleTutorOpen}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            Consult AI Tutor
          </button>
        </div>

        {/* Feedback row */}
        {feedback === "show" && (
          <div className="card-feedback visible">
            <span className="feedback-question">Was this session helpful?</span>
            <div className="feedback-buttons">
              <button className="feedback-btn thumbs-up" onClick={() => submitFeedback("up")}>👍 Yes</button>
              <button className="feedback-btn thumbs-down" onClick={() => submitFeedback("down")}>👎 No</button>
            </div>
          </div>
        )}
        {feedback === "up" && (
          <div className="card-feedback visible">
            <span className="feedback-confirmed positive">👍 Thanks! Glad that helped.</span>
          </div>
        )}
        {feedback === "down" && (
          <div className="card-feedback visible">
            <span className="feedback-confirmed negative">👎 Got it — we'll improve this explanation.</span>
          </div>
        )}
      </div>

      {tutorOpen && (
        <TutorModal
          topic={card.topic}
          card={card}
          studentCtx={studentCtx}
          onClose={handleTutorCloseWithFlag}
        />
      )}
    </>
  );
};

// ─── AnalysisResult ──────────────────────────────────────────────────────────

const AnalysisResult = ({ analysis, studentCtx }) => {
  const [expanded, setExpanded] = useState(true);
  const results = analysis.results || {};
  const rawRecs = results.recommendations || [];
  // Filter out malformed / empty recommendation entries that cause blank cards
  const recs = Array.isArray(rawRecs)
    ? rawRecs.filter(r => r && (r.topic || r.wrong_answer || r.correction || r.book || r.start_page))
    : [];

  return (
    <div className="message assistant">
      <div className="message-header">
        <div className="message-avatar assistant-av">M</div>
        <div className="message-author">VidyaSetu</div>
      </div>
      <div className="message-content">

        {/* Toggle button */}
        <div className="analysis-toggle-bar">
          <span className="analysis-file-tag">📄 {analysis.file_name}</span>
          <button className="analysis-toggle-btn" onClick={() => setExpanded(v => !v)}>
            {expanded ? "Hide" : "Show"} results
          </button>
        </div>

        {expanded && (
          <>
            <div className="result-summary">
              <h3>✨ Analysis Complete</h3>
              <div className="result-stats">
                <div className="stat">
                  <div className="stat-value">{results.total_wrong_answers ?? recs.length}</div>
                  <div className="stat-label">Issues Found</div>
                </div>
                <div className="stat">
                  <div className="stat-value">{results.total_recommendations ?? recs.length}</div>
                  <div className="stat-label">Topics</div>
                </div>
                <div className="stat">
                  <div className="stat-value">{results.processing_time != null ? `${results.processing_time}s` : "—"}</div>
                  <div className="stat-label">Processing</div>
                </div>
              </div>
            </div>

            {recs.map((card, i) => (
              <RecommendationCard key={i} card={card} studentCtx={studentCtx} />
            ))}

            {recs.length === 0 && (
              <p style={{ color: "var(--text-tertiary)", fontSize: "14px", marginTop: "12px" }}>
                No specific recommendations were generated for this paper.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ─── ChatInterface ───────────────────────────────────────────────────────────

const ChatInterface = ({ chat, analyzePaper }) => {
  const [uploadedFile, setUploadedFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = (file) => {
    if (!file) return;
    setUploadedFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const runAnalysis = async () => {
    if (!uploadedFile || analyzing) return;
    setAnalyzing(true);
    await analyzePaper(chat, uploadedFile);
    setUploadedFile(null);
    setAnalyzing(false);
  };

  return (
    <>
      <div className="chat-header">
        <div className="chat-header-title">
          <div className="user-avatar hdr-av">{chat.student_name?.charAt(0)}</div>
          <div>
            <h2 className="hdr-name">{chat.student_name}</h2>
            <p className="hdr-sub">{chat.class_level ? `Class ${chat.class_level}` : "Student"}{chat.subject ? ` · ${chat.subject}` : ""}</p>
          </div>
        </div>
      </div>

      <div className="messages" id="messages">
        {/* Upload panel */}
        <div className="upload-panel">
          <div
            className={`file-upload-area${dragOver ? " drag-over" : ""}${uploadedFile ? " has-file" : ""}`}
            onClick={() => fileInputRef.current?.click()}
            onDragEnter={() => setDragOver(true)}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <span className="upload-icon">📄</span>
            <div className="upload-text">Click to upload or drag and drop</div>
            <div className="upload-hint">PDF, JPG, PNG (Max 10 MB)</div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="file-input"
            onChange={(e) => handleFileSelect(e.target.files[0])}
          />

          {uploadedFile && (
            <div className="file-info active">
              <span className="file-icon">📄</span>
              <div className="file-details">
                <div className="file-name">{uploadedFile.name}</div>
                <div className="file-size">{formatFileSize(uploadedFile.size)}</div>
              </div>
              <button className="remove-file" onClick={(e) => { e.stopPropagation(); setUploadedFile(null); }}>
                Remove
              </button>
            </div>
          )}

          {uploadedFile && (
            <button className="start-analysis-btn" onClick={runAnalysis} disabled={analyzing}>
              {analyzing ? "Analysing…" : "Start Analysis"}
            </button>
          )}
        </div>

        {/* Past analyses */}
        {(chat.analyses || []).map((analysis, i) => (
          <AnalysisResult key={i} analysis={analysis} studentCtx={chat} />
        ))}
      </div>
    </>
  );
};

// ─── Sidebar ─────────────────────────────────────────────────────────────────

const Sidebar = ({ chats, currentChatId, setCurrentChatId, createNewChat, deleteChat }) => {
  const [studentName, setStudentName] = useState("");
  const [classLevel, setClassLevel] = useState("");
  const [subject, setSubject] = useState("");
  const [creating, setCreating] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const handleCreate = async () => {
    if (!studentName.trim()) return;
    setCreating(true);
    await createNewChat({ student_name: studentName.trim(), class_level: classLevel, subject });
    setStudentName(""); setClassLevel(""); setSubject("");
    setFormOpen(false);
    setCreating(false);
  };

  const chatList = Object.values(chats);

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="logo">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
          VidyaSetu
        </div>
      </div>

      <div className="sidebar-content">
        <button className="new-chat-btn" onClick={() => setFormOpen(v => !v)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Analysis
        </button>

        {formOpen && (
          <div className="new-chat-form">
            <input
              className="form-input"
              placeholder="Student name *"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <select className="form-select" value={classLevel} onChange={(e) => setClassLevel(e.target.value)}>
              <option value="">Select class</option>
              {[6,7,8,9,10,11,12].map(c => <option key={c} value={c}>Class {c}</option>)}
            </select>
            <select className="form-select" value={subject} onChange={(e) => setSubject(e.target.value)}>
              <option value="">Select subject</option>
              <option value="mathematics">Mathematics</option>
              <option value="physics">Physics</option>
              <option value="chemistry">Chemistry</option>
              <option value="biology">Biology</option>
              <option value="english">English</option>
              <option value="social-science">Social Science</option>
            </select>
            <button
              className="start-analysis-btn"
              onClick={handleCreate}
              disabled={creating || !studentName.trim()}
            >
              {creating ? "Creating…" : "Create Chat"}
            </button>
          </div>
        )}

        <div className="chat-history">
          {chatList.length === 0 && (
            <p className="empty-history">No analyses yet. Create one above.</p>
          )}
          {chatList.map((chat) => (
            <div
              key={chat.id}
              className={`chat-item-row${currentChatId === chat.id ? " active" : ""}`}
            >
              <button
                className="chat-item-main"
                onClick={() => setCurrentChatId(chat.id)}
              >
                <div className="chat-item-title">
                  {chat.student_name}{chat.subject ? ` — ${chat.subject}` : ""}
                </div>
                {chat.class_level && (
                  <div className="chat-item-time">Class {chat.class_level}</div>
                )}
              </button>
              <button
                className="chat-delete-btn"
                onClick={(e) => { e.stopPropagation(); deleteChat(chat.id); }}
                title="Delete"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-avatar">T</div>
          <div id="currentUser">Teacher</div>
        </div>
      </div>
    </div>
  );
};

// ─── WelcomeScreen ────────────────────────────────────────────────────────────

const WelcomeScreen = () => (
  <div className="chat-container">
    <div className="welcome-screen">
      <div className="welcome-content">
        <div className="welcome-header">
          <h1 className="welcome-title">Welcome to VidyaSetu</h1>
          <p className="welcome-subtitle">AI-Powered Personalised Learning Companion</p>
          <p className="welcome-description">
            Create a student chat from the sidebar, then upload a test paper to start analysis.
          </p>
        </div>
      </div>
    </div>
  </div>
);

// ─── App ─────────────────────────────────────────────────────────────────────

const App = () => {
  const [chats, setChats] = useState({});
  const [currentChatId, setCurrentChatId] = useState(null);
  const [loadError, setLoadError] = useState(null);

  // Load existing chats on mount
  useEffect(() => {
    fetch(`${API_BASE}/chat/list`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then((list) => {
        const map = {};
        (list || []).forEach((c) => (map[c.id] = c));
        setChats(map);
      })
      .catch((err) => {
        console.error("Failed to load chats:", err);
        setLoadError("Could not connect to the server. Make sure the API is running.");
      });
  }, []);

  const createNewChat = async ({ student_name, class_level, subject }) => {
    const form = new FormData();
    form.append("student_name", student_name);
    if (class_level) form.append("class_level", class_level);
    if (subject) form.append("subject", subject);

    const res = await fetch(`${API_BASE}/chat/create`, { method: "POST", body: form });
    if (!res.ok) {
      const text = await res.text();
      console.error("Create chat failed:", text);
      alert("Failed to create chat. Check console.");
      return;
    }

    const chat = await res.json();
    setChats((p) => ({ ...p, [chat.id]: chat }));
    setCurrentChatId(chat.id);
  };

  const deleteChat = async (id) => {
    const res = await fetch(`${API_BASE}/chat/${id}`, { method: "DELETE" });
    if (!res.ok) { console.error("Delete failed:", await res.text()); return; }

    setChats((p) => { const c = { ...p }; delete c[id]; return c; });
    if (currentChatId === id) setCurrentChatId(null);
  };

  const analyzePaper = async (chat, file) => {
    const form = new FormData();
    form.append("chat_id", chat.id);
    form.append("file", file);

    // Optimistically show the uploaded file message
    const pendingEntry = {
      timestamp: new Date().toISOString(),
      file_name: file.name,
      results: null,
      pending: true,
    };

    setChats((prev) => ({
      ...prev,
      [chat.id]: { ...chat, analyses: [...(chat.analyses || []), pendingEntry] },
    }));

    const res = await fetch(`${API_BASE}/analyze`, { method: "POST", body: form });
    const results = await res.json();

    if (results?.error) {
      console.error("Analysis failed:", results.error);
      alert("Analysis failed: " + results.error);
      // Remove pending entry
      setChats((prev) => ({
        ...prev,
        [chat.id]: {
          ...prev[chat.id],
          analyses: (prev[chat.id].analyses || []).filter((a) => !a.pending),
        },
      }));
      return;
    }

    setChats((prev) => {
      const updatedAnalyses = (prev[chat.id].analyses || []).map((a) =>
        a.pending ? { ...a, results, pending: false } : a
      );
      return { ...prev, [chat.id]: { ...prev[chat.id], analyses: updatedAnalyses } };
    });
  };

  const currentChat = currentChatId ? chats[currentChatId] : null;

  return (
    <div className="app-container">
      <Sidebar
        chats={chats}
        currentChatId={currentChatId}
        setCurrentChatId={setCurrentChatId}
        createNewChat={createNewChat}
        deleteChat={deleteChat}
      />

      <div className="main-content">
        {loadError && (
          <div className="error-banner">{loadError}</div>
        )}
        {!currentChat ? (
          <WelcomeScreen />
        ) : (
          <ChatInterface chat={currentChat} analyzePaper={analyzePaper} />
        )}
      </div>
    </div>
  );
};

// ─── Boot ─────────────────────────────────────────────────────────────────────

const root = createRoot(document.getElementById("root"));
root.render(<App />);
