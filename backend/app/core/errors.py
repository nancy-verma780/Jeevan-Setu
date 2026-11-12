from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class DomainError(Exception):
    status_code = 400

    def __init__(self, message: str, code: str | None = None):
        super().__init__(message)
        self.message = message
        self.code = code


class NotFound(DomainError):
    status_code = 404


class Conflict(DomainError):
    status_code = 409


class Invalid(DomainError):
    status_code = 422


class TooManyRequests(DomainError):
    status_code = 429


class UnsupportedMedia(DomainError):
    status_code = 415


def install_handlers(app: FastAPI) -> None:
    @app.exception_handler(DomainError)
    async def _domain_error(_: Request, exc: DomainError) -> JSONResponse:
        content = {"detail": exc.message}
        if exc.code:
            content["code"] = exc.code
        return JSONResponse(status_code=exc.status_code, content=content)
