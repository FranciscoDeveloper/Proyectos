import json
import re
import boto3
from botocore.exceptions import ClientError

ses = boto3.client("ses", region_name="us-east-1")

SES_FROM = "admin@dairi.cl"

CORS_HEADERS = {
    "Content-Type":                 "application/json",
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
}


def build(status_code, body):
    return {
        "statusCode": status_code,
        "headers":    CORS_HEADERS,
        "body":       json.dumps(body) if body is not None else "",
    }


def resolve_from_address(from_):
    """Extracts a bare email address from a "Display Name <email>" header value.
    SES's Source parameter actually accepts either form directly, but every
    caller in this codebase is normalized the same way regardless of that."""
    if not from_:
        return SES_FROM
    match = re.search(r"<(.+?)>", from_)
    return match.group(1).strip() if match else from_.strip()


def extract_email_fields(source):
    """Pulls and validates {to, subject, html, text, from} out of a plain dict.
    Single place both entry points below funnel through, so validation can't
    drift between the HTTP and direct-invoke paths.

    Raises ValueError(message) — a plain, transport-agnostic error message —
    on anything missing; each caller decides how to shape that into its own
    response format.
    """
    to      = source.get("to")
    subject = source.get("subject")
    html    = source.get("html")
    text    = source.get("text")
    from_   = source.get("from")

    if not to or not subject or (not html and not text):
        raise ValueError("Faltan campos: to, subject, html/text")

    return to, subject, html, text, resolve_from_address(from_)


def send_ses(to, subject, html, text, from_addr=None):
    """Core SES send — the only function that actually talks to SES. Shared by
    the HTTP and direct-invoke paths below."""
    sender = from_addr or SES_FROM
    message_body = (
        {"Html": {"Data": html, "Charset": "UTF-8"}}
        if html
        else {"Text": {"Data": text, "Charset": "UTF-8"}}
    )
    ses.send_email(
        Source=sender,
        Destination={"ToAddresses": [to]},
        Message={
            "Subject": {"Data": subject, "Charset": "UTF-8"},
            "Body":    message_body,
        },
    )


def lambda_handler(event, context):
    # ── Direct Lambda invocation (from VPC lambdas via AWS SDK) ───────────────
    # Detected by absence of requestContext/httpMethod and presence of "to".
    is_direct = (
        "requestContext" not in event
        and "httpMethod"  not in event
        and "to" in event
    )

    if is_direct:
        try:
            to, subject, html, text, from_addr = extract_email_fields(event)
        except ValueError as e:
            return {"ok": False, "error": str(e)}

        try:
            send_ses(to, subject, html, text, from_addr)
            return {"ok": True}
        except ClientError as e:
            code = e.response["Error"]["Code"]
            msg  = e.response["Error"]["Message"]
            print(f"[send-email direct] SES error {code}: {msg}")
            return {"ok": False, "error": f"{code}: {msg}"}
        except Exception as e:
            print(f"[send-email direct] Unexpected error: {e}")
            return {"ok": False, "error": str(e)}

    # ── HTTP API Gateway invocation ───────────────────────────────────────────
    method = (
        event.get("requestContext", {}).get("http", {}).get("method")
        or event.get("httpMethod", "UNKNOWN")
    )

    if method == "OPTIONS":
        return build(204, None)

    if method != "POST":
        return build(405, {"message": "Método no permitido"})

    raw_body = event.get("body") or "{}"
    try:
        body = json.loads(raw_body) if isinstance(raw_body, str) else raw_body
    except Exception:
        return build(400, {"message": "Body inválido: se esperaba JSON"})

    try:
        to, subject, html, text, from_addr = extract_email_fields(body)
    except ValueError as e:
        return build(400, {"message": str(e)})

    try:
        send_ses(to, subject, html, text, from_addr)
        return build(200, {"ok": True})

    except ClientError as e:
        code = e.response["Error"]["Code"]
        msg  = e.response["Error"]["Message"]
        print(f"[send-email] SES ClientError {code}: {msg}")
        return build(500, {"message": "Error al enviar correo", "error": f"{code}: {msg}"})

    except Exception as e:
        print(f"[send-email] Error inesperado: {e}")
        return build(500, {"message": "Error interno", "error": str(e)})
