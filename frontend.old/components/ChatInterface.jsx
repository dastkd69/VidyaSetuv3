const { useState } = React;

const ChatInterface = ({ chat, analyzePaper, appendMessage, useGpu }) => {
  const [uploadedFile, setUploadedFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const analyzeTestPaper = async () => {
    if (!uploadedFile) return;

    setAnalyzing(true);

    try {
      await appendMessage(chat.id, {
        role: "user",
        content: `Uploaded test paper: ${uploadedFile.name}`,
        timestamp: new Date().toISOString(),
        file_path: null,
      });

      const results = await analyzePaper(chat, uploadedFile);

      await appendMessage(chat.id, {
        role: "assistant",
        content: `Analysis complete! Found ${results.total_wrong_answers} wrong answers.`,
        timestamp: new Date().toISOString(),
        file_path: null,
      });
    } catch (err) {
      try {
        await appendMessage(chat.id, {
          role: "assistant",
          content: `❌ Analysis failed: ${err.message}`,
          timestamp: new Date().toISOString(),
          file_path: null,
        });
      } catch (appendErr) {
        console.error("Failed to persist error message:", appendErr);
      }
    }

    setAnalyzing(false);
    setUploadedFile(null);
  };

  return (
    <>
      <div className="chat-header">
        <div className="chat-header-title">
          <div className="user-avatar">{(chat.student_name || "S").charAt(0).toUpperCase()}</div>
          <div>
            <h2>{chat.student_name}</h2>
            <p>{chat.class_level ? `Class ${chat.class_level}` : "Class not set"}</p>
          </div>
        </div>
        <button onClick={() => setUploadedFile(null)} className="new-chat-btn chat-reset-btn">
          New Analysis
        </button>
      </div>

      <div className="chat-container">
        <div className="messages">
          <div className="message user">
            <div className="message-header">
              <div className="message-avatar">{(chat.student_name || "S").charAt(0).toUpperCase()}</div>
              <div className="message-author">{chat.student_name}</div>
            </div>
          </div>

        {(chat.messages || []).length > 0 && (
          <>
            {(chat.messages || []).map((msg, idx) => (
              <div
                key={idx}
                className={`message ${msg.role === "user" ? "user" : "assistant"}`}
              >
                <div className="message-header">
                  <div className="message-avatar">{msg.role === "user" ? "U" : "M"}</div>
                  <div className="message-author">{msg.role === "user" ? "You" : "Mentora"}</div>
                </div>
                <div className="message-content">
                  <div className="wrong-answer">{msg.content}</div>
                  <div className="message-time">{formatTimestamp(msg.timestamp)}</div>
                </div>
              </div>
            ))}
          </>
        )}

          <div className="analysis-form upload-panel">
            <h3 className="form-title">Upload Test Paper</h3>
            <div className={`file-upload-area ${uploadedFile ? "has-file" : ""}`}>
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => setUploadedFile(e.target.files[0])}
              className="file-input"
              id="file-upload"
            />
              <label htmlFor="file-upload" className="upload-label">
                <span className="upload-icon">📄</span>
                <div className="upload-text">Click to upload test paper PDF</div>
                <div className="upload-hint">PDF only</div>
              {uploadedFile && (
                  <div className="file-info active">
                    <span className="file-icon">📄</span>
                    <div className="file-details">
                      <div className="file-name">{uploadedFile.name}</div>
                    </div>
                  </div>
              )}
            </label>
          </div>
          </div>

          {uploadedFile && (
            <button
              onClick={analyzeTestPaper}
              disabled={analyzing}
              className="start-analysis-btn"
            >
              {analyzing ? (
                <span>Analyzing... ({useGpu ? "GPU" : "CPU"} mode)</span>
              ) : (
                <span>Start Analysis</span>
              )}
            </button>
          )}
        </div>

        {chat.analyses && chat.analyses.length > 0 && (
          <div>
            {chat.analyses
              .slice()
              .reverse()
              .map((analysis, idx) => (
                <AnalysisResult key={idx} analysis={analysis} />
              ))}
          </div>
        )}
        </div>
      </div>
    </>
  );
};
