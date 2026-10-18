export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
