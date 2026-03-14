const { useState, useEffect } = React;

const API_BASE = "http://localhost:8000";

const App = () => {
  const [chats, setChats] = useState({});
  const [currentChatId, setCurrentChatId] = useState(null);
  const [useGpu, setUseGpu] = useState(true);
  const [gpuAvailable] = useState(true);

  // -------------------------------------------------
  // Load existing chats on startup
  // -------------------------------------------------
  useEffect(() => {
    fetch(`${API_BASE}/chat/list`)
      .then((r) => r.json())
      .then((list) => {
        const map = {};
        list.forEach((c) => {
          map[c.id] = c;
        });
        setChats(map);
      })
      .catch((err) => {
        console.error("Failed to load chats:", err);
      });
  }, []);

  // -------------------------------------------------
  // Create chat (API-backed)
  // -------------------------------------------------
  const createNewChat = async (studentName, classLevel, subject) => {
    const form = new FormData();
    form.append("student_name", studentName);

    if (classLevel !== null && classLevel !== undefined) {
      form.append("class_level", classLevel);
    }
    if (subject) {
      form.append("subject", subject);
    }

    try {
      const res = await fetch(`${API_BASE}/chat/create`, {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const chat = await res.json();

      setChats((prev) => ({ ...prev, [chat.id]: chat }));
      setCurrentChatId(chat.id);
    } catch (err) {
      console.error("Create chat failed:", err);
      alert("Create chat failed. Check console.");
    }
  };

  // -------------------------------------------------
  // Delete chat (API-backed)
  // -------------------------------------------------
  const deleteChat = async (chatId) => {
    if (!confirm("Are you sure you want to delete this chat?")) return;

    try {
      const res = await fetch(`${API_BASE}/chat/${chatId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      setChats((prev) => {
        const copy = { ...prev };
        delete copy[chatId];
        return copy;
      });

      if (currentChatId === chatId) {
        setCurrentChatId(null);
      }
    } catch (err) {
      console.error("Delete chat failed:", err);
      alert("Delete chat failed. Check console.");
    }
  };

  // -------------------------------------------------
  // Update chat in memory
  // -------------------------------------------------
  const updateChat = (chatId, updatedData) => {
    setChats((prev) => ({
      ...prev,
      [chatId]: {
        ...prev[chatId],
        ...updatedData,
      },
    }));
  };

  const currentChat = currentChatId ? chats[currentChatId] : null;

  // -------------------------------------------------
  // Analytics
  // -------------------------------------------------
  const appendMessage = async (chatId, message) => {
    const res = await fetch(`${API_BASE}/chat/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message }),
    });

    if (!res.ok) {
      throw new Error(await res.text());
    }

    const updatedChat = await res.json();
    setChats((prev) => ({ ...prev, [updatedChat.id]: updatedChat }));
    return updatedChat;
  };

  const analyzePaper = async (chat, file) => {
    if (!file || !chat) return;

    const formData = new FormData();
    formData.append("chat_id", chat.id);
    formData.append("file", file);

    if (chat.class_level) {
      formData.append("class_level", chat.class_level);
    }
    if (chat.subject) {
      formData.append("subject", chat.subject);
    }

    try {
      const res = await fetch(`${API_BASE}/analyze`, {
        method: "POST",
        body: formData,
      });

      const results = await res.json();

      if (results.error) {
        throw new Error(results.error);
      }

      updateChat(chat.id, {
        analyses: [
          ...(chat.analyses || []),
          {
            timestamp: new Date().toISOString(),
            file_name: file.name,
            results,
          },
        ],
      });
      return results;
    } catch (err) {
      console.error("Analysis failed:", err);
      throw err;
    }
  };

  // -------------------------------------------------
  // Render
  // -------------------------------------------------
  return (
    <div className="app-container">
      <Sidebar
        chats={chats}
        currentChatId={currentChatId}
        setCurrentChatId={setCurrentChatId}
        createNewChat={createNewChat}
        deleteChat={deleteChat}
        useGpu={useGpu}
        setUseGpu={setUseGpu}
        gpuAvailable={gpuAvailable}
      />

      <div className="main-content">
        {!currentChat ? (
          <WelcomeScreen />
        ) : (
          <ChatInterface
            chat={currentChat}
            analyzePaper={analyzePaper}
            appendMessage={appendMessage}
            useGpu={useGpu}
          />
        )}
      </div>
    </div>
  );
};
