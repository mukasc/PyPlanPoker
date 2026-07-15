# Backend Unit Testing Documentation

This document explains the backend unit testing setup, how the tests are configured, and how to execute them.

## Setup Overview

We use `pytest` along with `pytest-asyncio` to run async unit tests for our FastAPI / Socket.IO backend. 

To keep the repository clean and avoid scan pollution from virtual environment dependency folders, we configure `pytest` to ignore venv-related folders and node modules.

### Configuration Files

1. **`pytest.ini`**: Located in the project root. It configures `pytest` behaviors:
   - Excludes third-party package directories (`venv`, `.venv`, `Lib`, `Include`, `Scripts`) and web dependency directories (`node_modules`) from search.
   - Restricts test file discovery to `test_backend_*.py` files, avoiding accidental collection of standard scripts (like `test_api.py`).
2. **`run_tests.bat`**: Located in the project root. A Windows batch file that sets `PYTHONIOENCODING=utf-8` to prevent Unicode encoding crashes on Windows console, then runs `pytest` using the project's virtual environment python.

---

## Test Suites

### Room Scoping Tests (`backend/test_backend_scoping.py`)

This test file verifies the room-scoped queries in the database. Scoping is critical to ensure that users (especially Google-authenticated users with persistent IDs) do not leak state between rooms.

The file tests three core scenarios using mocks for `motor` MongoDB driver and `socket.io` server:

1. **`test_join_room_scoping`**:
   - Mocks the socket connection when a user joins a room.
   - Asserts that `is_online: True` is updated only for the matching combination of `id` and `room_id`.
2. **`test_disconnect_scoping`**:
   - Mocks the socket disconnection.
   - Asserts that `is_online: False` is updated only for the matching combination of `id` and `room_id`.
3. **`test_cast_vote_scoping`**:
   - Mocks the HTTP post request to `/api/vote`.
   - Asserts that the voter validation query retrieves the user document using both `id` and `room_id` to ensure spectator and active voter states are scoped properly.

---

## How to Run Tests

From the project root directory, run the batch script on Windows:

```cmd
.\run_tests.bat
```

To pass additional arguments to pytest (e.g. verbose logging or running a specific test):

```cmd
.\run_tests.bat -v
.\run_tests.bat backend/test_backend_scoping.py::test_join_room_scoping
```
