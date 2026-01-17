"""LangGraph + LangChain agent that always reads backend JSON via a tool."""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Annotated, Any, Dict, List, Optional, Sequence, TypedDict

from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)
from langchain_core.tools import tool
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages


class AgentState(TypedDict):
    """State carried through the LangGraph run."""

    messages: Annotated[Sequence[BaseMessage], add_messages]
    number_of_steps: int
    frontend_payload: Optional[dict]
    backend_json_path: str


def _load_json(path: str) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _get_by_path(data: Any, path: str) -> Any:
    """Resolve dot/index path like users.0.email."""
    parts = [p for p in path.split(".") if p]
    current: Any = data
    for part in parts:
        if isinstance(current, list) and part.isdigit():
            idx = int(part)
            if idx >= len(current):
                raise KeyError(f"index {idx} out of range for list")
            current = current[idx]
        elif isinstance(current, dict):
            if part not in current:
                raise KeyError(f"key '{part}' not found")
            current = current[part]
        else:
            raise KeyError(f"cannot descend into '{part}' on non-container")
    return current


def _collect_paths(data: Any, prefix: str = "") -> List[Dict[str, Any]]:
    results: List[Dict[str, Any]] = []
    if isinstance(data, dict):
        for k, v in data.items():
            new_prefix = f"{prefix}.{k}" if prefix else k
            results.extend(_collect_paths(v, new_prefix))
    elif isinstance(data, list):
        for i, v in enumerate(data):
            new_prefix = f"{prefix}.{i}" if prefix else str(i)
            results.extend(_collect_paths(v, new_prefix))
    else:
        results.append({"path": prefix, "value": data})
    return results


@tool
def search_backend_json(query: str, backend_json_path: str, top_k: int = 5) -> Dict[str, Any]:
    """
    Look up data in the backend JSON file.
    - Use 'path:<dot.path>' for direct path lookup (e.g., path:assignments.0.name).
    - Otherwise performs a keyword search across leaf values and returns top_k matches.
    """
    print(f"Tool search_backend_json: reading JSON at {backend_json_path}")
    data = _load_json(backend_json_path)
    if query.startswith("path:"):
        dot_path = query[len("path:") :].strip()
        try:
            value = _get_by_path(data, dot_path)
            return {"mode": "path", "path": dot_path, "value": value}
        except KeyError as err:
            return {"mode": "path", "path": dot_path, "error": str(err)}

    leaves = _collect_paths(data)
    query_lower = query.lower()
    matches = [
        leaf for leaf in leaves if query_lower in str(leaf["value"]).lower()
    ]
    print(f"Tool search_backend_json: keyword search for '{query}', returning up to {top_k} results.")
    return {"mode": "search", "query": query, "results": matches[:top_k]}


def ingest_frontend(state: AgentState) -> AgentState:
    """Inject the frontend payload into the messages before the first LLM call."""
    payload = state.get("frontend_payload") or {}
    frontend_note = json.dumps({"frontend_payload": payload}, ensure_ascii=False)
    print("Ingest: injecting frontend payload into system context.")
    new_messages = list(state.get("messages", [])) + [
        SystemMessage(
            content=(
                "Frontend context injected for grounding. "
                "Use this when deciding what backend JSON to fetch.\n"
                f"{frontend_note}"
            )
        )
    ]
    return {
        **state,
        "messages": new_messages,
        "number_of_steps": state.get("number_of_steps", 0),
    }


def _build_system_message() -> SystemMessage:
    return SystemMessage(
        content=(
            "You are a backend retrieval assistant. Policy:\n"
            "- If the user asks for any data that could be in the backend JSON, "
            "call the tool search_backend_json. Do not guess values.\n"
            "- Never hallucinate values; prefer tool calls.\n"
            "- The backend_json_path is provided; do not assume other data sources.\n"
            "- Keep replies concise unless asked otherwise."
        )
    )


def call_model(state: AgentState) -> Dict[str, Any]:
    llm = ChatGoogleGenerativeAI(
        model="gemini-2.5-pro",
        api_key=os.getenv("GEMINI_API_KEY"),
    ).bind_tools([search_backend_json])

    messages = [_build_system_message(), *state["messages"]]
    print("LLM: sending messages to Gemini...")
    response = llm.invoke(messages)
    print("LLM: received response from Gemini.")
    return {"messages": [response], "number_of_steps": state.get("number_of_steps", 0) + 1}


def call_tool(state: AgentState) -> Dict[str, Any]:
    last_msg = state["messages"][-1]
    if not isinstance(last_msg, AIMessage) or not last_msg.tool_calls:
        return {"messages": [], "number_of_steps": state.get("number_of_steps", 0)}

    tool_messages: List[ToolMessage] = []
    backend_json_path = state["backend_json_path"]

    for call in last_msg.tool_calls:
        name = call["name"]
        args = call.get("args", {}) or {}
        if name == "search_backend_json":
            # Ensure backend_json_path is always provided
            args["backend_json_path"] = backend_json_path
        print(f"Tool runner: executing {name} with args={args}")
        try:
            tool_result = search_backend_json.invoke(args)
            content_str = json.dumps(tool_result, ensure_ascii=False)
        except Exception as exc:  # pragma: no cover - safety net
            content_str = json.dumps({"error": str(exc)}, ensure_ascii=False)
        print(f"Tool runner: {name} completed.")
        tool_messages.append(
            ToolMessage(
                content=content_str,
                name=name,
                tool_call_id=call["id"],
            )
        )

    return {
        "messages": tool_messages,
        "number_of_steps": state.get("number_of_steps", 0),
    }


def should_continue(state: AgentState) -> str:
    if not state["messages"]:
        return END
    last_msg = state["messages"][-1]
    if isinstance(last_msg, AIMessage) and getattr(last_msg, "tool_calls", None):
        return "tools"
    return END


def build_graph() -> Any:
    graph = StateGraph(AgentState)
    graph.add_node("ingest", ingest_frontend)
    graph.add_node("llm", call_model)
    graph.add_node("tools", call_tool)

    graph.add_edge("ingest", "llm")
    graph.add_conditional_edges("llm", should_continue, {"tools": "tools", END: END})
    graph.add_edge("tools", "llm")

    graph.set_entry_point("ingest")
    return graph.compile()


compiled_graph = build_graph()


def send_prompt_to_backend(
    text: str,
    *,
    frontend_payload: Optional[dict] = None,
    backend_json_path: Optional[str] = None,
) -> str:
    """Entry point to run the graph with a user prompt."""
    path =  "dummy_data.json"
    initial_state: AgentState = {
        "messages": [HumanMessage(content=text)],
        "number_of_steps": 0,
        "frontend_payload": frontend_payload or {},
        "backend_json_path": path
    }
    print("Driver: invoking graph with user text.")
    result = compiled_graph.invoke(initial_state)

    # Collect latest AI response content (if any)
    ai_contents = [
        msg.content for msg in result.get("messages", []) if isinstance(msg, AIMessage)
    ]
    final_text = ai_contents[-1] if ai_contents else ""
    print(f"Driver: final Gemini reply -> {final_text}")
    return final_text


if __name__ == "__main__":
    send_prompt_to_backend(
        "What is the description and points for Assignment 05?",
        frontend_payload={"user_id": "123", "course_id": "ABC"},
    )
