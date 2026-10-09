export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

// errors are i18n keys, e.g. bad('err_not_found', 404)
export function bad(errors, status = 400) {
  return json({ errors: Array.isArray(errors) ? errors : [errors] }, status);
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

// Short public ids for URLs; long secret tokens.
export const newId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 12);
export const newToken = () => crypto.randomUUID().replace(/-/g, '');
