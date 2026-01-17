"""LangGraph + LangChain agent that always reads backend JSON via a tool."""
from __future__ import annotations

import json
import os
from typing import Annotated, Any, Dict, List, Optional, Sequence, TypedDict

from canvasData import (
    get_course_announcements,
    get_course_assignments,
    get_course_files,
    get_course_pages,
    get_courses,
    canvas as canvas_client,
)
from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)
from langchain_core.tools import tool
from pydantic import BaseModel, Field, ValidationError
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages


class AgentState(TypedDict):
    """State carried through the LangGraph run."""

    messages: Annotated[Sequence[BaseMessage], add_messages]
    number_of_steps: int
    frontend_payload: Optional[dict]


class CourseInput(BaseModel):
    course_id: int = Field(..., description="Canvas course ID to operate on.")


@tool(args_schema=CourseInput)
def fetch_course_pages(course_id: int) -> Dict[str, Any]:
    """Return Canvas course pages (title/html); use when asked for page content/list of pages."""
    print(f"Tool fetch_course_pages: running for course_id={course_id}")
    return {"pages": get_course_pages(course_id)}


@tool(args_schema=CourseInput)
def fetch_course_assignments(course_id: int) -> Dict[str, Any]:
    """Return Canvas course assignments with metadata; use when asked about assignments or due details."""
    print(f"Tool fetch_course_assignments: running for course_id={course_id}")
    return {"assignments": get_course_assignments(course_id)}


@tool(args_schema=CourseInput)
def fetch_course_files(course_id: int) -> Dict[str, Any]:
    """Return Canvas course files with metadata and URLs; use when asked about files/resources."""
    print(f"Tool fetch_course_files: running for course_id={course_id}")
    return {"files": get_course_files(course_id)}


@tool(args_schema=CourseInput)
def fetch_course_announcements(course_id: int) -> Dict[str, Any]:
    """Return Canvas course announcements; use when asked about announcements/notices."""
    print(f"Tool fetch_course_announcements: running for course_id={course_id}")
    return {"announcements": get_course_announcements(course_id)}


@tool
def fetch_courses() -> Dict[str, Any]:
    """List available courses; use to let the user pick a course before fetching details."""
    print("Tool fetch_courses: listing courses")
    return {"courses": get_courses()}


ALL_TOOLS = [
    fetch_courses,
    fetch_course_pages,
    fetch_course_assignments,
    fetch_course_files,
    fetch_course_announcements,
]
TOOL_REGISTRY = {tool.name: tool for tool in ALL_TOOLS}


def ingest_frontend(state: AgentState) -> AgentState:
    """Inject the frontend payload into the messages before the first LLM call."""
    payload = state.get("frontend_payload") or {}
    frontend_note = json.dumps({"frontend_payload": payload}, ensure_ascii=False)
    print("Ingest: injecting frontend payload into conversation for grounding.")
    new_messages = list(state.get("messages", [])) + [
        HumanMessage(content=f"Frontend payload (JSON): {frontend_note}")
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
            "- For Canvas course data use the fetch_* Canvas tools (courses, pages, assignments, files, announcements) "
            "instead of making up answers.\n"
            "- If a course ID is unclear, first call fetch_courses to list options and/or ask the user to pick one.\n"
            "- Never hallucinate values; prefer tool calls.\n"
            "- Choose the minimal set of tool calls and then respond to the user.\n"
            "- Keep replies concise unless asked otherwise."
        )
    )


def call_model(state: AgentState) -> Dict[str, Any]:
    llm = ChatGoogleGenerativeAI(
        model="gemini-2.5-pro",
        api_key=os.getenv("GEMINI_API_KEY"),
    ).bind_tools(ALL_TOOLS)

    messages = [_build_system_message(), *state["messages"]]
    print("LLM: sending messages to Gemini...")
    response = llm.invoke(messages)
    print(f"LLM: received response from Gemini. Tool calls: {getattr(response, 'tool_calls', None)}")
    return {"messages": [response], "number_of_steps": state.get("number_of_steps", 0) + 1}


def call_tool(state: AgentState) -> Dict[str, Any]:
    last_msg = state["messages"][-1]
    if not isinstance(last_msg, AIMessage) or not last_msg.tool_calls:
        return {"messages": [], "number_of_steps": state.get("number_of_steps", 0)}

    tool_messages: List[ToolMessage] = []

    for call in last_msg.tool_calls:
        name = call["name"]
        args = call.get("args", {}) or {}
        tool = TOOL_REGISTRY.get(name)
        if not tool:
            content_str = json.dumps({"error": f"Unknown tool {name}"}, ensure_ascii=False)
            tool_messages.append(
                ToolMessage(content=content_str, name=name, tool_call_id=call["id"])
            )
            continue

        print(f"Tool runner: executing {name} with args={args}")
        try:
            tool_result = tool.invoke(args)
            content_str = json.dumps(tool_result, ensure_ascii=False, default=str)
        except ValidationError as exc:
            content_str = json.dumps({"error": exc.errors()}, ensure_ascii=False)
        except Exception as exc:  # pragma: no cover - safety net
            content_str = json.dumps({"error": str(exc)}, ensure_ascii=False)
        print(f"Tool runner: {name} completed with result {content_str}")
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
        return "end"
    last_msg = state["messages"][-1]
    if isinstance(last_msg, AIMessage) and getattr(last_msg, "tool_calls", None):
        return "continue"
    return "end"


def build_graph() -> Any:
    graph = StateGraph(AgentState)
    graph.add_node("ingest", ingest_frontend)
    graph.add_node("llm", call_model)
    graph.add_node("tools", call_tool)

    graph.add_edge("ingest", "llm")
    graph.add_conditional_edges("llm", should_continue, {"continue": "tools", "end": END})
    graph.add_edge("tools", "llm")

    graph.set_entry_point("ingest")
    return graph.compile()


compiled_graph = build_graph()


def send_prompt_to_backend(
    text: str,
    *,
    frontend_payload: Optional[dict] = None,
    existing_messages: Optional[Sequence[BaseMessage]] = None,
) -> str:
    """Entry point to run the graph with a user prompt."""
    base_messages: List[BaseMessage] = list(existing_messages or [])
    base_messages.append(HumanMessage(content=text))

    initial_state: AgentState = {
        "messages": base_messages,
        "number_of_steps": 0,
        "frontend_payload": frontend_payload or {},
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

