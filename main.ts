// main.ts
import { serve } from "https://deno.land/std/http/server.ts";

const kv = await Deno.openKv();

// Generate random token (10 chars)
function genToken() {
  const arr = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 10);
}

serve(async (req) => {
  const url = new URL(req.url);

  // ------------------------
  // 1) API: CREATE SHORT LINK
  // ------------------------
  if (url.pathname === "/create" && req.method === "POST") {
    try {
      const body = await req.json();
      const src = body.src?.trim();

      if (!src) {
        return new Response(JSON.stringify({ error: "Missing src" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const token = genToken();
      await kv.set(["token", token], { src });

      return new Response(
        JSON.stringify({ short: `${url.origin}/r/${token}`, src }),
        { headers: { "Content-Type": "application/json" } }
      );
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // ------------------------
  // 2) REDIRECT
  // ------------------------
  if (url.pathname.startsWith("/r/")) {
    const token = url.pathname.replace("/r/", "");
    const { value } = await kv.get(["token", token]);
    if (!value) return new Response("Invalid short link", { status: 404 });

    return Response.redirect(value.src, 302);
  }

  // ------------------------
  // 3) HOME PAGE (Web UI)
  // ------------------------
  return new Response(
    `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>MovieZone ShortLink Generator</title>
<style>
body { font-family: sans-serif; text-align:center; padding:50px; }
input[type=text] { width: 60%; padding:10px; font-size:16px; }
button { padding:10px 20px; font-size:16px; margin-left:10px; cursor:pointer; }
#result { margin-top:20px; font-weight:bold; }
</style>
</head>
<body>
<h2>MovieZone ShortLink Generator</h2>
<p>Enter any direct MP4 or image URL:</p>
<input type="text" id="src" placeholder="https://mediafire.com/xxxx/file.mp4">
<button onclick="generate()">Generate</button>
<div id="result"></div>
<script>
async function generate() {
  const src = document.getElementById('src').value.trim();
  if(!src) return alert('Please enter a link.');
  const res = await fetch('/create', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({src})
  });
  const data = await res.json();
  if(data.error) {
    document.getElementById('result').innerText = data.error;
  } else {
    document.getElementById('result').innerHTML = 'Short Link: <a href="'+data.short+'" target="_blank">'+data.short+'</a>';
  }
}
</script>
</body>
</html>
`,
    { headers: { "Content-Type": "text/html" } }
  );
});
