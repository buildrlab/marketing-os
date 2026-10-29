FROM python:3.13-slim
WORKDIR /app
COPY app ./app
COPY data ./data
COPY skills ./skills
COPY web ./web
RUN useradd --create-home --uid 10001 demo && mkdir /app/runtime && chown demo:demo /app/runtime
USER demo
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 HOST=0.0.0.0
CMD ["python", "-m", "app.server", "app"]
