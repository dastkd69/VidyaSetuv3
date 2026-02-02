# analysis/reporting.py

import json
import csv
from pathlib import Path
from datetime import datetime


class ReportWriter:
    def save_all(self, results: dict, output_dir: Path):
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        base = Path(results["test_paper"]).stem

        # JSON
        with open(output_dir / f"{base}_{ts}.json", "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2, ensure_ascii=False)

        # CSV
        with open(output_dir / f"{base}_{ts}.csv", "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow([
                "wrong_answer_text",
                "page",
                "detected_topic",
                "topic_confidence",
                "book_name",
                "class_level",
                "chapters",
                "page_range",
                "confidence",
            ])

            for rec in results["recommendations"]:
                for n in rec["recommendations"]:
                    writer.writerow([
                        rec["wrong_answer_text"],
                        rec["page"],
                        rec["detected_topic"],
                        rec["topic_confidence"],
                        n.get("category"),
                        n.get("class_level"),
                        "",
                        "",
                        n.get("confidence"),
                    ])


    def print_summary(self, results: dict):
        print("\n" + "=" * 60)
        print("ANALYSIS COMPLETE")
        print("=" * 60)
        print(f"Test Paper: {results['test_paper']}")
        print(f"Processing Time: {results['processing_time']}s")
        print(f"Wrong Answers: {results['total_wrong_answers']}")
        print(f"Recommendations: {results['total_recommendations']}")
        print("=" * 60 + "\n")
