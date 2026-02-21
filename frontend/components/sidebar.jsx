const { useState } = React;

const Sidebar = ({ chats, currentChatId, setCurrentChatId, createNewChat, deleteChat, useGpu, setUseGpu, gpuAvailable }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [showNewChatForm, setShowNewChatForm] = useState(false);
    const [studentName, setStudentName] = useState('');
    const [classLevel, setClassLevel] = useState(null);
    const [subject, setSubject] = useState('english');

    const handleCreateChat = async () => {
        if (!studentName.trim()) {
            alert('Please enter a student name');
            return;
        }
        await createNewChat(studentName, classLevel, subject);
        setStudentName('');
        setClassLevel(null);
        setSubject('english');
        setShowNewChatForm(false);
    };

    const filteredChats = Object.values(chats).filter(chat =>
        chat.student_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="sidebar">
            <div className="sidebar-header">
                <div className="logo">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2L2 7l10 5 10-5-10-5z" />
                        <path d="M2 17l10 5 10-5" />
                        <path d="M2 12l10 5 10-5" />
                    </svg>
                    Mentora
                </div>
            </div>

            <div className="sidebar-content">
                <button
                    onClick={() => setShowNewChatForm(!showNewChatForm)}
                    className="new-chat-btn"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    New Student Chat
                </button>

                {showNewChatForm && (
                    <div className="create-chat-form fade-in">
                        <div className="form-group">
                            <label className="form-label">Student Name</label>
                            <input
                                type="text"
                                placeholder="Enter student name"
                                value={studentName}
                                onChange={(e) => setStudentName(e.target.value)}
                                className="form-input"
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Class</label>
                            <select
                                value={classLevel || ''}
                                onChange={(e) => setClassLevel(e.target.value ? parseInt(e.target.value) : null)}
                                className="form-select"
                            >
                                <option value="">Not specified</option>
                                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                                    <option key={n} value={n}>Class {n}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Subject</label>
                            <select
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                className="form-select"
                            >
                                <option value="english">English</option>
                                <option value="math">Math</option>
                            </select>
                        </div>

                        <button
                            onClick={handleCreateChat}
                            className="start-analysis-btn create-chat-submit"
                        >
                            Create Chat
                        </button>
                    </div>
                )}

                <div className="settings-block">
                    <div className="settings-title">Settings</div>
                    {gpuAvailable ? (
                        <div>
                            <div className="settings-note success">GPU available</div>
                            <label className="settings-toggle">
                                <span>Use GPU for analysis</span>
                                <input
                                    type="checkbox"
                                    checked={useGpu}
                                    onChange={(e) => setUseGpu(e.target.checked)}
                                />
                            </label>
                        </div>
                    ) : (
                        <div className="settings-note warning">No GPU detected - using CPU</div>
                    )}
                </div>

                <div className="sidebar-search">
                    <input
                        type="text"
                        placeholder="Search students..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="form-input"
                    />
                </div>

                <div className="chat-history">
                    {filteredChats.length > 0 ? (
                        filteredChats
                            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                            .map((chat) => (
                                <div
                                    key={chat.id}
                                    className={`chat-item-row ${currentChatId === chat.id ? 'active' : ''}`}
                                >
                                    <button
                                        onClick={() => setCurrentChatId(chat.id)}
                                        className="chat-item-main"
                                    >
                                        <div className="chat-item-title">{chat.student_name}</div>
                                        <div className="chat-item-time">
                                            {chat.class_level ? `Class ${chat.class_level}` : 'Class not set'}
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => deleteChat(chat.id)}
                                        className="chat-delete-btn"
                                        aria-label="Delete chat"
                                        title="Delete chat"
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M3 6h18" />
                                            <path d="M8 6V4h8v2" />
                                            <path d="M19 6l-1 14H6L5 6" />
                                            <path d="M10 11v6" />
                                            <path d="M14 11v6" />
                                        </svg>
                                    </button>
                                </div>
                            ))
                    ) : (
                        <div className="empty-chats">
                            {searchQuery ? `No students found for "${searchQuery}"` : 'No chats yet'}
                        </div>
                    )}
                </div>
            </div>

            <div className="sidebar-footer">
                <button className="help-btn" type="button">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    Data stored in backend
                </button>
                <div className="user-info">
                    <div className="user-avatar">T</div>
                    <div id="currentUser">Teacher</div>
                </div>
            </div>
        </div>
    );
};

