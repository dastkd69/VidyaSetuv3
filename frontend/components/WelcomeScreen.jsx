const WelcomeScreen = () => {
    return (
        <div className="chat-container">
            <div className="welcome-screen">
                <div className="welcome-content">
                    <div className="welcome-header">
                        <h1 className="welcome-title">Welcome to Mentora</h1>
                        <p className="welcome-subtitle">AI-Powered Personalised Learning Companion</p>
                        <p className="welcome-description">
                            Create a student chat from the sidebar, then upload a test paper to start analysis.
                        </p>
                    </div>

                    <div className="analysis-form">
                        <h2 className="form-title">How to get started</h2>
                        <div className="welcome-steps">
                            <div className="welcome-step">
                                <span className="step-index">1</span>
                                <div>
                                    <div className="step-title">Create a new student chat</div>
                                    <div className="step-description">Set student details and subject in the sidebar.</div>
                                </div>
                            </div>
                            <div className="welcome-step">
                                <span className="step-index">2</span>
                                <div>
                                    <div className="step-title">Upload the test paper</div>
                                    <div className="step-description">Use PDF upload in the chat panel for that student.</div>
                                </div>
                            </div>
                            <div className="welcome-step">
                                <span className="step-index">3</span>
                                <div>
                                    <div className="step-title">Review recommendations</div>
                                    <div className="step-description">Get topic insights and NCERT pages to revise.</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};


