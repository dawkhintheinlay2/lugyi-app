// main.ts
import { serve } from "https://deno.land/std/http/server.ts";

const kv = await Deno.openKv();

// Random token (10 chars)
function genToken() {
  const arr = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 10);
}

serve(async (req) => {
  const url = new URL(req.url);

  // -------------------------------------------------
  // 1) CREATE TOKEN SHORT LINK
  // -------------------------------------------------
  if (url.pathname === "/create") {
    const src = url.searchParams.get("src"); // MediaFire Direct MP4 URL

    if (!src) {
      return new Response("Missing ?src=", { status: 400 });
    }

    const token = genToken();

    await kv.set(["token", token], {
      src,
    });

    return new Response(
      JSON.stringify({
        short: `${url.origin}/r/${token}`,
        src,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  // -------------------------------------------------
  // 2) REDIRECT USING TOKEN
  // -------------------------------------------------
  if (url.pathname.startsWith("/r/")) {
    const token = url.pathname.replace("/r/", "");

    const { value } = await kv.get(["token", token]);

    if (!value) {
      return new Response("Invalid token", { status: 404 });
    }

    // Redirect to real MediaFire direct URL
    return Response.redirect(value.src, 302);
  }

  // -------------------------------------------------
  // 3) HOME PAGE (optional)
  // -------------------------------------------------
  return new Response(
    `
      <h2>MovieZone ShortLink API</h2>
      <p>Use format:</p>
      <code>/create?src=MEDIAFIRE_DIRECT_MP4_URL</code>
    `,
    { headers: { "Content-Type": "text/html" } },
  );
});
