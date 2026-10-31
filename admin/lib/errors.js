import { translate } from "../public/i18n/translate.js";

// Errors a user can see carry a stable code and its parameters; the browser
// shows them in its own language (public/i18n/, "error.<code>"). The message
// is the English text, for the logs and as the fallback.
export class AdminError extends Error {
  constructor(code, params = {}, status = 500) {
    super(translate("en", `error.${code}`, params));
    this.code = code;
    this.params = params;
    this.status = status;
  }
}

// The same, answered with an HTTP status.
export class HttpError extends AdminError {
  constructor(status, code, params = {}) {
    super(code, params, status);
  }
}

// { message, code, params } for any error: unexpected ones keep their text
// as a parameter.
export function describeError(error) {
  if (error instanceof AdminError) return { message: error.message, code: error.code, params: error.params };
  const message = String(error?.message ?? error);
  return { message: translate("en", "error.unexpected", { detail: message }), code: "unexpected", params: { detail: message } };
}
