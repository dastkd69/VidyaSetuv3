const WelcomeScreen = () => {
    return (
        <div className="flex-1 flex items-center justify-center p-8">
            <div className="max-w-2xl text-center space-y-6">
                <h1 className="text-4xl font-bold text-blue-600 mb-4">📚 Test Paper Analyzer</h1>
                <div className="bg-white rounded-xl shadow-lg p-8 text-left space-y-4 fade-in">
                    <h2 className="text-2xl font-semibold text-gray-800">Welcome! 👋</h2>
                    <p className="text-gray-600">
                        This application helps analyze student test papers and recommends relevant NCERT study materials.
                    </p>
                    <div className="space-y-3">
                        <h3 className="font-semibold text-gray-800">To get started:</h3>
                        <ol className="space-y-2 text-gray-600">
                            <li>1. Create a new student chat in the sidebar</li>
                            <li>2. Upload a test paper PDF</li>
                            <li>3. Get personalized study recommendations</li>
                        </ol>
                    </div>
                    <div className="space-y-3 pt-4 border-t border-gray-200">
                        <h3 className="font-semibold text-gray-800">Features:</h3>
                        <ul className="space-y-2 text-gray-600">
                            <li>✅ Multiple student chats</li>
                            <li>✅ Automatic topic detection</li>
                            <li>✅ NCERT book recommendations</li>
                            <li>✅ FastAPI-backed storage</li>
                            <li>✅ Persistent data across sessions</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};


