from __future__ import annotations

from pathlib import Path
import time
import json

from llama_cpp import Llama


class TutorLLMService:
    def __init__(
        self,
        model_path: Path,
        n_ctx: int = 2048,
        temperature: float = 0.2,
        max_tokens: int = 120,
    ):
        self.llm = Llama(
            model_path=str(model_path),
            n_ctx=n_ctx,
            n_threads=2,
            n_gpu_layers=0,
            verbose=False,
        )
        self.temperature = temperature
        self.max_tokens = max_tokens

    def _debug_log(self, hypothesis_id: str, location: str, message: str, data: dict, run_id: str = "initial") -> None:
        payload = {
            "runId": run_id,
            "hypothesisId": hypothesis_id,
            "location": location,
            "message": message,
            "data": data,
            "timestamp": int(time.time() * 1000),
        }
        try:
            with open("/home/ec2-user/Vidyasetu/.cursor/debug.log", "a", encoding="utf-8") as f:
                f.write(json.dumps(payload, ensure_ascii=False) + "\n")
        except Exception:
            pass

    def generate(
        self,
        context_chunks: list[str],
        wrong_answer: str,
        chat_history: list[dict],
    ) -> str:
        if not context_chunks or all(len(chunk.strip()) < 20 for chunk in context_chunks):
            return "I do not have enough information in the selected pages."

        context_chunks = context_chunks[:3]
        context_block = "\n\n".join(context_chunks)

        history_lines = []
        for message in chat_history:
            role = message.get("role", "")
            content = message.get("content", "")
            if role.lower() == "assistant":
                history_lines.append(f"Assistant: {content}")
            else:
                history_lines.append(f"User: {content}")
        chat_text = "\n".join(history_lines)

        system_message = (
            "You are an English tutor.\n\n"
            "You MUST answer using ONLY the provided CONTEXT excerpts.\n\n"
            "You are NOT allowed to:\n"
            "- Infer beyond the text\n"
            "- Add examples not present in the excerpts\n"
            "- Introduce new rules not explicitly shown\n\n"
            "If the excerpts contain repeated sentence patterns that clearly demonstrate a grammatical rule, "
            "you may explain the rule based on that pattern.\n"
            "Do not invent new examples.\n"
            "Do not use knowledge not supported by the excerpts.\n\n"
            "Every explanation MUST be directly supported by the provided text.\n\n"
            "If the CONTEXT does not clearly explain the mistake, you MUST say:\n"
            "\"I do not have enough information in the selected pages.\"\n\n"
            "Keep the explanation concise (4–6 sentences)."
        )
        user_prompt = (
            "CONTEXT:\n"
            f"{context_block}\n\n"
            "STUDENT MISTAKE:\n"
            f"{wrong_answer}\n\n"
            "CONVERSATION:\n"
            f"{chat_text}"
        )

        prompt = f"""<|system|>
{system_message}</s>
<|user|>
{user_prompt}</s>
<|assistant|>
"""

        start_time = time.time()
        max_gen_tokens = min(self.max_tokens, 90)
        response = self.llm(
            prompt,
            max_tokens=max_gen_tokens,
            temperature=0.15,
            top_p=0.85,
            repeat_penalty=1.12,
            stop=["<|user|>", "<|assistant|>", "\n5.", "\n6.", "\n\n5.", "\n\n6."],
        )
        elapsed = time.time() - start_time
        print(f"✅ Tutor LLM response time: {elapsed:.2f}s")
        output_text = response["choices"][0]["text"].strip()
        if output_text.upper().startswith("CONTEXT:"):
            return "I do not have enough information in the selected pages."

        return output_text

    def generate_stream(
        self,
        context_chunks: list[str],
        wrong_answer: str,
        chat_history: list[dict],
    ):
        # region agent log
        self._debug_log(
            "Q4",
            "backend/services/tutor_llm_service.py:stream-entry",
            "Generation stream started",
            {
                "context_chunk_count": len(context_chunks or []),
                "context_lengths": [len((c or "").strip()) for c in (context_chunks or [])[:3]],
                "wrong_answer_prefix": (wrong_answer or "")[:120],
            },
        )
        # endregion
        if not context_chunks or all(len(chunk.strip()) < 20 for chunk in context_chunks):
            # region agent log
            self._debug_log(
                "Q4",
                "backend/services/tutor_llm_service.py:stream-guard",
                "Short context guard fired",
                {"reason": "insufficient_context"},
            )
            # endregion
            yield "I do not have enough information in the selected pages."
            return

        context_chunks = context_chunks[:3]
        context_block = "\n\n".join(context_chunks)

        system_message = (
            "You are an NCERT tutor.\n\n"
            "You MUST answer using ONLY the provided CONTEXT excerpts.\n\n"
            "You are NOT allowed to:\n"
            "- Use prior knowledge\n"
            "- Infer beyond the text\n"
            "- Add examples not present in the excerpts\n"
            "- Introduce new rules not explicitly shown\n\n"
            "If the excerpts contain repeated sentence patterns that clearly demonstrate a grammatical rule, "
            "you may explain the rule based on that pattern.\n"
            "Do not invent new examples.\n"
            "Do not use knowledge not supported by the excerpts.\n\n"
            "Every explanation MUST be directly supported by the provided text.\n\n"
            "If the CONTEXT does not clearly explain the mistake, you MUST say:\n"
            "\"I do not have enough information in the selected pages.\"\n\n"
            "Keep the explanation concise (4–6 sentences)."
        )
        user_prompt = (
            "CONTEXT:\n"
            f"{context_block}\n\n"
            "STUDENT MISTAKE:\n"
            f"{wrong_answer}"
        )

        prompt = (
            "You are an NCERT tutor.\n\n"
            "You MUST answer using ONLY the provided CONTEXT excerpts.\n"
            "Do not use prior knowledge, do not infer beyond the text, "
            "and do not add examples not present in the excerpts.\n"
            "If the excerpts contain repeated sentence patterns that clearly demonstrate a grammatical rule, "
            "you may explain the rule based on that pattern.\n"
            "Do not invent new examples.\n"
            "Do not use knowledge not supported by the excerpts.\n"
            "If context is insufficient, reply exactly: "
            "\"I do not have enough information in the selected pages.\"\n\n"
            f"CONTEXT:\n{context_block}\n\n"
            f"STUDENT MISTAKE:\n{wrong_answer}\n\n"
            "Answer in 4-6 concise sentences:"
        )

        start_time = time.time()
        max_gen_tokens = min(self.max_tokens, 90)
        token_count = 0
        first_tokens: list[str] = []
        buffered_tokens: list[str] = []
        should_flush_buffer = False
        echo_guard_triggered = False
        output_preview = ""
        for chunk in self.llm(
            prompt,
            max_tokens=max_gen_tokens,
            temperature=0.15,
            top_p=0.85,
            repeat_penalty=1.12,
            stop=["\nCONTEXT:", "\nSTUDENT MISTAKE:", "User:", "Assistant:", "\n5.", "\n6.", "\n\n5.", "\n\n6."],
            stream=True,
        ):
            token = chunk["choices"][0]["text"]
            token_count += 1
            if len(first_tokens) < 8:
                first_tokens.append(token)
            if not should_flush_buffer:
                buffered_tokens.append(token)
                probe_text = "".join(buffered_tokens).lstrip()
                if probe_text.upper().startswith("CONTEXT:"):
                    echo_guard_triggered = True
                    # region agent log
                    self._debug_log(
                        "Q5",
                        "backend/services/tutor_llm_service.py:echo-guard",
                        "Prompt echo guard triggered",
                        {"probe_prefix": probe_text[:120]},
                    )
                    # endregion
                    fallback = "I do not have enough information in the selected pages."
                    output_preview = (output_preview + fallback)[:240]
                    yield fallback
                    break
                if len(probe_text) >= 24 or token_count >= 6:
                    should_flush_buffer = True
                    for buffered in buffered_tokens:
                        output_preview = (output_preview + buffered)[:240]
                        yield buffered
                    buffered_tokens = []
            else:
                output_preview = (output_preview + token)[:240]
                yield token
        elapsed = time.time() - start_time
        print(f"✅ Tutor LLM response time: {elapsed:.2f}s")
        output_text = output_preview.strip()
        sentences = [s.strip() for s in output_text.split("\n") if s.strip()]
        repeated_lines = len(sentences) - len(set(sentences))
        context_tokens = set(word.lower() for word in context_block.split())
        output_tokens = [word.lower() for word in output_text.split()]
        overlap = sum(1 for tok in output_tokens if tok in context_tokens)
        overlap_ratio = (overlap / len(output_tokens)) if output_tokens else 0.0
        # region agent log
        self._debug_log(
            "Q6",
            "backend/services/tutor_llm_service.py:stream-exit",
            "Generation stream finished",
            {
                "token_count": token_count,
                "first_tokens": first_tokens,
                "echo_guard_triggered": echo_guard_triggered,
                "output_preview": output_preview,
                "repeated_lines": repeated_lines,
                "overlap_ratio": round(overlap_ratio, 4),
                "max_gen_tokens": max_gen_tokens,
                "hit_token_limit": token_count >= max_gen_tokens,
                "elapsed_seconds": round(elapsed, 3),
            },
        )
        # endregion