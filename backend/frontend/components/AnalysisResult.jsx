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
        <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden card-hover">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition"
            >
                <span className="font-semibold text-gray-800">
                    📄 {analysis.file_name} ({new Date(analysis.timestamp).toLocaleDateString()})
                </span>
                <span className="text-gray-500">{expanded ? '▼' : '▶'}</span>
            </button>

            {expanded && (
                <div className="p-6 border-t border-gray-200 space-y-6 fade-in">
                    {/* Metrics */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-red-50 p-4 rounded-lg border border-red-200 metric-card">
                            <div className="text-2xl font-bold text-red-600">{results.total_wrong_answers}</div>
                            <div className="text-sm text-gray-600">Wrong Answers</div>
                        </div>
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 metric-card">
                            <div className="text-2xl font-bold text-blue-600">{results.total_recommendations}</div>
                            <div className="text-sm text-gray-600">Study Topics</div>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg border border-green-200 metric-card">
                            <div className="text-2xl font-bold text-green-600">{results.processing_time}s</div>
                            <div className="text-sm text-gray-600">Analysis Time</div>
                        </div>
                    </div>

                    {results.recommendations && (
                        <>
                            {/* Overview */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <h4 className="font-semibold text-gray-800 mb-2">📖 What does this mean?</h4>
                                <p className="text-gray-700">
                                    Based on the test paper analysis, we found <strong>{results.total_wrong_answers} questions</strong> that need attention.
                                    We've identified the topics where the student needs improvement and found the exact pages in NCERT books.
                                </p>
                            </div>

                            {/* Top Topics */}
                            <div>
                                <h4 className="font-semibold text-gray-800 mb-3">🎯 Areas Needing Most Attention</h4>
                                <div className="space-y-2">
                                    {sortedTopics.map(([topic, count], idx) => (
                                        <div key={idx} className="text-gray-700">
                                            <span className="font-semibold">{idx + 1}. {topic}</span>
                                            <span className="text-gray-500"> — Found in {count} question{count > 1 ? 's' : ''}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Recommendations */}
                            <div>
                                <h4 className="font-semibold text-gray-800 mb-3">📚 Recommended Study Materials</h4>
                                <div className="space-y-6">
                                    {topTopics.map(([topic, recommendations], idx) => {
                                        const bestRec = recommendations.sort((a, b) => b.topic_confidence - a.topic_confidence)[0];
                                        const topNcert = bestRec.recommendations?.[0];

                                        return topNcert && (
                                            <div key={idx} className="border border-gray-200 rounded-lg p-5 bg-gray-50">
                                                <h5 className="text-lg font-semibold text-gray-800 mb-3">
                                                    {idx + 1}. {topic}
                                                </h5>

                                                <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
                                                    <div className="font-semibold text-gray-800">📖 Study Resource:</div>
                                                    <div className="space-y-1 text-gray-700">
                                                        <div><strong>Book:</strong> {topNcert.book_name}</div>
                                                        <div><strong>Class:</strong> {topNcert.class_level}</div>
                                                        <div><strong>Chapters:</strong> {topNcert.chapters}</div>
                                                        <div><strong>Pages:</strong> {topNcert.page_range}</div>
                                                        <div className="pt-2">
                                                            <strong>Why this helps:</strong> Covers {topic.toLowerCase()} from {recommendations.length} question(s).
                                                        </div>
                                                    </div>
                                                </div>

                                                <details className="mt-3">
                                                    <summary className="cursor-pointer text-blue-600 hover:text-blue-700 font-medium">
                                                        🔍 See example question
                                                    </summary>
                                                    <div className="mt-2 p-3 bg-white rounded border border-gray-200">
                                                        <div className="text-gray-700">
                                                            {bestRec.wrong_answer_text.substring(0, 300)}...
                                                        </div>
                                                        <div className="text-xs text-gray-500 mt-2">
                                                            Page {bestRec.page}
                                                        </div>
                                                    </div>
                                                </details>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Action Plan */}
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                <h4 className="font-semibold text-gray-800 mb-2">💡 Quick Action Plan</h4>
                                <div className="space-y-2 text-gray-700">
                                    <ol className="ml-4 space-y-1">
                                        <li>1. Focus on the top {Math.min(5, topTopics.length)} topics</li>
                                        <li>2. Read recommended NCERT pages</li>
                                        <li>3. Practice similar questions</li>
                                        <li>4. Review mistake examples</li>
                                    </ol>
                                    <div className="pt-2">
                                        <strong>⏰ Time needed:</strong> {topTopics.length * 30}-{topTopics.length * 45} minutes
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};