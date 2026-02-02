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
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-gray-800">
              👤 {chat.student_name}
            </h2>
            {chat.class_level && (
              <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                🎓 Class {chat.class_level}
              </span>
            )}
          </div>
          <button
            onClick={() => setUploadedFile(null)}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            🔄 New Analysis
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Chat Messages */}
        {(chat.messages || []).length > 0 && (
          <>
            <h3 className="text-lg font-semibold text-gray-800">
              📜 Chat History
            </h3>
            {(chat.messages || []).map((msg, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-lg chat-message ${
                  msg.role === "user"
                    ? "bg-blue-50 border border-blue-200"
                    : "bg-gray-50 border border-gray-200"
                }`}
              >
                <div className="font-semibold text-gray-800 mb-1">
                  {msg.role === "user" ? "You:" : "Assistant:"}
                </div>
                <div className="text-gray-700">{msg.content}</div>
                <div className="text-xs text-gray-500 mt-2">
                  🕐 {formatTimestamp(msg.timestamp)}
                </div>
              </div>
            ))}
          </>
        )}

        {/* Upload Section */}
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            📤 Upload Test Paper
          </h3>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center upload-area">
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => setUploadedFile(e.target.files[0])}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <div className="text-4xl mb-3">📄</div>
              <p className="text-gray-600">Click to upload test paper PDF</p>
              {uploadedFile && (
                <p className="text-green-600 font-medium mt-2">
                  ✅ {uploadedFile.name}
                </p>
              )}
            </label>
          </div>

          {uploadedFile && (
            <button
              onClick={analyzeTestPaper}
              disabled={analyzing}
              className="mt-4 w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {analyzing ? (
                <span>🔄 Analyzing... ({useGpu ? "GPU" : "CPU"} mode)</span>
              ) : (
                <span>🔍 Analyze Paper</span>
              )}
            </button>
          )}
        </div>

        {/* Analysis Results */}
        {chat.analyses && chat.analyses.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">
              📊 Analysis Results
            </h3>
            {chat.analyses
              .slice()
              .reverse()
              .map((analysis, idx) => (
                <AnalysisResult key={idx} analysis={analysis} />
              ))}
          </div>
        )}
      </div>
    </>
  );
};
