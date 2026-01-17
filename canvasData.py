import canvasapi
from canvasapi import Canvas

API_URL = "https://canvas.nus.edu.sg"
API_KEY = "21450~tcuXB7Ex8yQw7MPyh7GmDXBLzrw8mNu3wGwTHAkhN2zzQTkk768Tm2ZWP77f3yyL"

canvas = Canvas(API_URL, API_KEY)


def get_course_pages(course):
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


def get_course_assignments(course):
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


def get_course_files(course):
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

def get_course_announcements(course):
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
