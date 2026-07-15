@echo off
set PYTHONIOENCODING=utf-8
backend\venv\Scripts\python -m pytest %*
