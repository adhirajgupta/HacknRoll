"""
Reusable Gemini chat chain with in-memory history.
NOTE: History is stored in-process and resets on server restart.
"""
from __future__ import annotations

import os
from typing import Dict

from dotenv import load_dotenv
from langchain_community.chat_message_histories import ChatMessageHistory
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_google_genai import ChatGoogleGenerativeAI

# Global in-memory store for session histories (resets on restart)
HISTORY_STORE: Dict[str, ChatMessageHistory] = {}


def get_history(session_id: str) -> ChatMessageHistory:
    """Return (or create) the chat history for a given session_id."""
    if session_id not in HISTORY_STORE:
        HISTORY_STORE[session_id] = ChatMessageHistory()
    return HISTORY_STORE[session_id]


def build_chain(model_name: str = "gemini-2.5-pro") -> RunnableWithMessageHistory:
    """Build a RunnableWithMessageHistory wrapping prompt | llm."""
    load_dotenv()
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise RuntimeError("Missing GEMINI_API_KEY/GOOGLE_API_KEY in environment or .env file.")

    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                "You are a helpful assistant. Do not hallucinate; if unsure, say you do not know.",
            ),
            MessagesPlaceholder(variable_name="history"),
            ("human", "{input}"),
        ]
    )

    llm = ChatGoogleGenerativeAI(
        model=model_name,
        api_key=api_key,
    )

    chain = prompt | llm

    return RunnableWithMessageHistory(
        chain,
        get_history,
        input_messages_key="input",
        history_messages_key="history",
    )
