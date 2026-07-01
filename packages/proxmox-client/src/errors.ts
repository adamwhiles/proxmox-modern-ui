export class ProxmoxApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly errors?: Record<string, string>,
  ) {
    super(message);
    this.name = "ProxmoxApiError";
  }
}

export class ProxmoxAuthError extends ProxmoxApiError {
  constructor(message = "Authentication failed") {
    super(message, 401);
    this.name = "ProxmoxAuthError";
  }
}
