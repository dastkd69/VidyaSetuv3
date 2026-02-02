const { useState } = React;

const Sidebar = ({ chats, currentChatId, setCurrentChatId, createNewChat, deleteChat, useGpu, setUseGpu, gpuAvailable }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [showNewChatForm, setShowNewChatForm] = useState(false);
    const [studentName, setStudentName] = useState('');
    const [classLevel, setClassLevel] = useState(null);

    const handleCreateChat = async () => {
        if (!studentName.trim()) {
            alert('Please enter a student name');
            return;
        }
        await createNewChat(studentName, classLevel);
        setStudentName('');
        setClassLevel(null);
        setShowNewChatForm(false);
    };

    const filteredChats = Object.values(chats).filter(chat =>
        chat.student_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col shadow-lg">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
                <h1 className="text-2xl font-bold text-blue-600 flex items-center gap-2">
                    📚 Test Paper Analyzer
                </h1>
            </div>

            {/* GPU Settings */}
            <div className="p-4 border-b border-gray-200 bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">⚙️ Settings</h3>
                {gpuAvailable ? (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-green-600">
                            <span className="font-medium">✅ GPU Available: NVIDIA RTX 3060</span>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={useGpu}
                                onChange={(e) => setUseGpu(e.target.checked)}
                                className="w-4 h-4 text-blue-600 rounded"
                            />
                            <span className="text-sm text-gray-700">Use GPU for Analysis</span>
                        </label>
                    </div>
                ) : (
                    <div className="text-sm text-amber-600">
                        ⚠️ No GPU detected - using CPU
                    </div>
                )}
            </div>

            {/* New Chat Section */}
            <div className="p-4 border-b border-gray-200">
                <button
                    onClick={() => setShowNewChatForm(!showNewChatForm)}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition font-medium"
                >
                    ➕ New Student Chat
                </button>

                {showNewChatForm && (
                    <div className="mt-4 space-y-3 p-4 bg-blue-50 rounded-lg fade-in">
                        <input
                            type="text"
                            placeholder="Student Name"
                            value={studentName}
                            onChange={(e) => setStudentName(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <select
                            value={classLevel || ''}
                            onChange={(e) => setClassLevel(e.target.value ? parseInt(e.target.value) : null)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="">Not specified</option>
                            {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                                <option key={n} value={n}>Class {n}</option>
                            ))}
                        </select>
                        <button
                            onClick={handleCreateChat}
                            className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition font-medium"
                        >
                            Create Chat
                        </button>
                    </div>
                )}
            </div>

            {/* Chat List */}
            <div className="flex-1 overflow-y-auto">
                <div className="p-4">
                    <div className="mb-3">
                        <input
                            type="text"
                            placeholder="🔍 Search students..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                    </div>

                    <h3 className="text-sm font-semibold text-gray-700 mb-2">💬 Student Chats</h3>

                    {filteredChats.length > 0 ? (
                        <div className="space-y-2">
                            {filteredChats
                                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                                .map(chat => (
                                    <div key={chat.id} className="flex items-center gap-2">
                                        <button
                                            onClick={() => setCurrentChatId(chat.id)}
                                            className={`flex-1 text-left px-3 py-2 rounded-lg transition ${
                                                currentChatId === chat.id
                                                    ? 'bg-blue-100 text-blue-700 font-medium'
                                                    : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                                            }`}
                                        >
                                            <div className="text-sm">👤 {chat.student_name}</div>
                                            {chat.class_level && (
                                                <div className="text-xs text-gray-500 mt-1">
                                                    Class {chat.class_level}
                                                </div>
                                            )}
                                        </button>
                                        <button
                                            onClick={() => deleteChat(chat.id)}
                                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                ))}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500 text-center py-4">
                            {searchQuery ? `No students found matching "${searchQuery}"` : 'No chats yet'}
                        </p>
                    )}
                </div>
            </div>

            <div className="p-4 border-t border-gray-200 text-xs text-gray-500">
                💾 Data stored in FastAPI backend
            </div>
        </div>
    );
};

