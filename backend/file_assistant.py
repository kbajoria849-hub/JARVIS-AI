from pathlib import Path
import os

# Only search folders explicitly approved here.
ALLOWED_FOLDERS = [
    Path.home() / "Documents",
    Path.home() / "Downloads",
    Path.home() / "Desktop",
    Path.home() / "Downloads" / "Telegram Desktop",
    Path(__file__).resolve().parent.parent,
]

MAX_RESULTS = 100


def get_allowed_folders():
    """Return existing approved folders without duplicates."""
    folders = []

    for folder in ALLOWED_FOLDERS:
        try:
            folder = folder.resolve()
            if folder.is_dir() and folder not in folders:
                folders.append(folder)
        except (OSError, RuntimeError):
            continue

    return folders


def is_inside_allowed_folder(path: Path) -> bool:
    """Allow access only within configured folders."""
    try:
        resolved = path.resolve()
        return any(
            resolved == folder or folder in resolved.parents
            for folder in get_allowed_folders()
        )
    except (OSError, RuntimeError):
        return False


def search_files(query: str, extension: str = ""):
    """Search approved folders by filename and optional extension."""
    query = query.strip().casefold()
    extension = extension.strip().casefold()

    if not query and not extension:
        return {"results": [], "error": "Enter a filename or extension."}

    if extension and not extension.startswith("."):
        extension = "." + extension

    results = []
    seen = set()

    for folder in get_allowed_folders():
        for root, dirs, files in os.walk(folder, followlinks=False):
            # Do not follow directory links outside approved folders.
            dirs[:] = [
                name for name in dirs
                if is_inside_allowed_folder(Path(root) / name)
            ]

            for name in files:
                path = Path(root) / name

                if query and query not in name.casefold():
                    continue

                if extension and path.suffix.casefold() != extension:
                    continue

                if not is_inside_allowed_folder(path):
                    continue

                resolved = str(path.resolve()).casefold()

                if resolved in seen: continue
                seen.add(resolved)

                results.append({
                    "name": name,
                    "path": str(path.resolve()),
                    "type": path.suffix or "No extension",
                })

                if len(results) >= MAX_RESULTS:
                    return {"results": results, "limit_reached": True}

    return {"results": results, "limit_reached": False}

def open_file(path_string: str):
    """Open an approved file using its default Windows application."""
    try:
        path = Path(path_string).resolve(strict=True)

        if not is_inside_allowed_folder(path):
            return {
                "success": False,
                "message": "This path is outside approved folders."
            }

        if not path.is_file():
            return {"success": False, "message": "File not found."}

        os.startfile(str(path))
        return {"success": True, "message": "Opening file."}

    except (OSError, RuntimeError, ValueError):
        return {"success": False, "message": "File could not be opened."}


def open_folder(path_string: str):
    """Open an approved folder or the folder containing a file."""
    try:
        path = Path(path_string).resolve(strict=True)

        if not is_inside_allowed_folder(path):
            return {
                "success": False,
                "message": "This path is outside approved folders."
            }

        if path.is_dir():
            folder = path
        elif path.is_file():
            folder = path.parent
        else:
            return {"success": False, "message": "Path not found."}

        # Validate the final folder before opening it.
        if not is_inside_allowed_folder(folder):
            return {
                "success": False,
                "message": "This folder is outside approved folders."
            }

        os.startfile(str(folder))
        return {"success": True, "message": "Opening folder."}

    except (OSError, RuntimeError, ValueError):
        return {"success": False, "message": "Folder could not be opened."}