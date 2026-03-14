const { useState } = React;

const AnalysisResult = ({ analysis }) => {
    const [expanded, setExpanded] = useState(true);
    const results = analysis.results;

    const topicCounts = {};
    results.recommendations?.forEach(rec => {
        const topic = rec.detected_topic;
        topicCounts[topic] = (topicCounts[topic] || 0) + 1;
    });

    const sortedTopics = Object.entries(topicCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    const topTopics = Object.entries(
        results.recommendations?.reduce((acc, rec) => {
            const topic = rec.detected_topic;
            if (!acc[topic]) acc[topic] = [];
            acc[topic].push(rec);
            return acc;
        }, {}) || {}
    )
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 3);

    return (
        <div className="analysis-wrapper">
            <button onClick={() => setExpanded(!expanded)} className="analysis-toggle">
                <span>{analysis.file_name} ({new Date(analysis.timestamp).toLocaleDateString()})</span>
                <span>{expanded ? "Hide" : "Show"}</span>
            </button>

            {expanded && (
                <div className="message-content fade-in">
                    <div className="result-summary">
                        <h3>Analysis Complete</h3>
                        <div className="result-stats">
                            <div className="stat">
                                <div className="stat-value">{results.total_wrong_answers}</div>
                                <div className="stat-label">Issues Found</div>
                            </div>
                            <div className="stat">
                                <div className="stat-value">{results.total_recommendations}</div>
                                <div className="stat-label">Recommendations</div>
                            </div>
                            <div className="stat">
                                <div className="stat-value">{results.processing_time}s</div>
                                <div className="stat-label">Processing Time</div>
                            </div>
                        </div>
                    </div>

                    {results.recommendations && topTopics.map(([topic, recommendations], idx) => {
                        const bestRec = recommendations.sort((a, b) => b.topic_confidence - a.topic_confidence)[0];
                        const topNcert = bestRec.recommendations?.[0];
                        if (!topNcert) return null;

                        return (
                            <div key={idx} className="recommendation-card">
                                <div className="recommendation-header">
                                    <div className="recommendation-topic">{topic}</div>
                                    <div className="confidence-badge">
                                        {Math.round((bestRec.topic_confidence || 0) * 100)}%
                                    </div>
                                </div>

                                <div className="wrong-answer">
                                    {bestRec.wrong_answer_text?.substring(0, 250)}...
                                </div>

                                <div className="recommendation-details">
                                    <div className="detail-row">
                                        <span className="detail-label">Book:</span>
                                        <span className="detail-value">{topNcert.book_name}</span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="detail-label">Class:</span>
                                        <span className="detail-value">{topNcert.class_level}</span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="detail-label">Chapter:</span>
                                        <span className="detail-value">{topNcert.chapters}</span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="detail-label">Pages:</span>
                                        <span className="detail-value">{topNcert.page_range}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {sortedTopics.length > 0 && (
                        <div className="result-summary compact">
                            <h3>Top Focus Areas</h3>
                            <div className="top-topic-list">
                                {sortedTopics.map(([topic, count], idx) => (
                                    <div key={idx} className="top-topic-item">
                                        <span>{idx + 1}. {topic}</span>
                                        <span>{count} question{count > 1 ? "s" : ""}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};