import canvasapi
from canvasapi import Canvas
from dotenv import load_dotenv

import os

load_dotenv()

API_URL = "https://canvas.nus.edu.sg"
API_KEY = os.getenv("API_KEY")  # Ensure
canvas = Canvas(API_URL, API_KEY)

def get_courses():
    """
    TOOL SCHEMA - What it does: List Canvas courses the user is enrolled in.
    When to use: This should ALWAYS be your initial task. Use this to select a course and get course id to execute other actions. 
    The user may not always type the full course code or course name, select the most appropriate based on their query, or ask them to clarify if needed.
    Inputs: none (uses authenticated Canvas client)
    Output: list of dicts {id, name}.
    """
    output = []
    for course in canvas.get_courses():
        try:
            if '[2520]' in course.name:
                output.append(
                    {
                        "id": course.id,
                        "name": course.name,
                    }
                )
        except AttributeError:
            continue
    return output

def get_course_pages(course_id):
    """
    TOOL SCHEMA — What it does: Fetch all pages in a Canvas course and return their titles and bodies.
    When to use: Use this first when you need some information about the course. If your question is about course content, course policy, assessment components and dates of important exams of the course,use pages to get the answer. 
    If the answer is not found or you run into an error, try other tools.
    Inputs: course_id (Canvas course ID)
    Output: list of dicts {title, html} or an error dict.
    """
    course = canvas.get_course(course_id)
    output = []
    try:
        pages = course.get_pages()
        for page in list(pages):
            page = page.show_latest_revision()
            output.append({
                "title": page.title,
                "html": page.body,
            })
    except canvasapi.exceptions.ResourceDoesNotExist:
        return {"Error": "No pages available for course"}
    return output


def get_course_assignments(course_id):
    """
    TOOL SCHEMA — What it does: Fetch all assignments for a Canvas course with grading, timing, and submission metadata.
    When to use: User asks about assignments, due dates of assignments, points, or submission status.
    Do not use: User asks about general midterm dates or final exam dates or assessment components/weightages
    If the answer is not found or you run into an error, try other tools.
    Inputs: course_id (Canvas course ID)
    Output: list of dicts {name, description, points_possible, grading_type, due_at, lock_at, unlock_at, submission_types, html_url, allowed_attempts, submission_status} or an error dict.
    """
    course = canvas.get_course(course_id)
    try:
        output = []
        assignments = course.get_assignments()
        for a in list(assignments):
            output.append({
                "name": a.name,
                "description": a.description,
                "points_possible": a.points_possible,
                "grading_type": a.grading_type,
                "due_at": a.due_at,
                "lock_at": a.lock_at,
                "unlock_at": a.unlock_at,
                "submission_types": a.submission_types,
                "html_url": a.html_url,
                "allowed_attempts": a.allowed_attempts,
                "submission_status": a.get_submission("self").workflow_state
            })
    except canvasapi.exceptions.ResourceDoesNotExist:
        return {"Error": "No assignments available for course"}
    return output


def get_course_files(course_id):
    """
    TOOL SCHEMA — What it does: List all files in a Canvas course with metadata and download URLs.
    When to use: User asks for course files, resources, or download links.
    If the answer is not found or you run into an error, try other tools.
    Inputs: course_id (Canvas course ID)
    Output: list of dicts {name, created_at, updated_at, url, content_type} or an error dict.
    """
    course = canvas.get_course(course_id)
    output = []
    try:
        files = course.get_files()
        for f in list(files):
            output.append({
                "name": f.display_name,
                "created_at": f.created_at,
                "updated_at": f.updated_at,
                "url": f.url,
                "content_type": f.__dict__['content-type']
            })
    except (canvasapi.exceptions.ResourceDoesNotExist, canvasapi.exceptions.Forbidden):
        return {"Error": "No files available for course"}
    return output

def get_course_announcements(course_id):
    """
    TOOL SCHEMA — What it does: Fetch announcements for a Canvas course with content and timestamps.
    When to use: To get additional data about the course which might contain the answer to a user's query.
    If the answer is not found or you run into an error, try other tools.
    Inputs: course_id (Canvas course ID)
    Output: list of dicts {title, message, posted_at, attachments} or an error dict.
    """
    course = canvas.get_course(course_id)
    announcements = []
    try:
        for announcement in canvas.get_announcements([course]):
            announcements.append({
                "title": announcement.title,
                "message": announcement.message,
                "posted_at": announcement.posted_at,
                "attachments": announcement.attachments,
            })
    except (canvasapi.exceptions.ResourceDoesNotExist, canvasapi.exceptions.Forbidden):
        return {"Error": "No announcements available for course"}
    return announcements
