// main.ts
import { serve } from "https://deno.land/std/http/server.ts";

const kv = await Deno.openKv();

function genToken() {
  const arr = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(arr, b => b.toString(16).padStart(2,"0")).join("").slice(0,10);
}

serve(async (req) => {
  const url = new URL(req.url);

  // -------------------------------
  // 1) CREATE TOKEN + detect extension
  // -------------------------------
  if(url.pathname === "/create" && req.method === "POST") {
    try {
      const body = await req.json();
      const src = body.src?.trim();
      if(!src) return new Response(JSON.stringify({error:"Missing src"}), {status:400, headers:{"Content-Type":"application/json"}});

      const token = genToken();
      const extMatch = src.match(/\.\w+$/);
      const ext = extMatch ? extMatch[0] : ".mp4";

      await kv.set(["token", token], { src, ext });

      return new Response(JSON.stringify({
        short: `${url.origin}/video/${token}${ext}`,
        token,
        src
      }), { headers:{"Content-Type":"application/json"} });

    } catch(e) {
      return new Response(JSON.stringify({error:"Invalid JSON"}), {status:400, headers:{"Content-Type":"application/json"}});
    }
  }

  // -------------------------------
  // 2) PROXY VIDEO / FILE
  // -------------------------------
  if(url.pathname.startsWith("/video/")) {
    const parts = url.pathname.split("/");
    let tokenExt = parts[2]; // TOKEN.EXT
    if(!tokenExt) return new Response("Token required", {status:401});

    const token = tokenExt.replace(/\.\w+$/, "");
    const { value } = await kv.get(["token", token]);
    if(!value) return new Response("Invalid token", {status:404});

    try {
      const mediaRes = await fetch(value.src);
      const headers: HeadersInit = new Headers(mediaRes.headers);
      return new Response(mediaRes.body, { headers, status: mediaRes.status });
    } catch(e) {
      return new Response("Failed to fetch", {status:500});
    }
  }

  // -------------------------------
  // 3) HOME PAGE (Web UI)
  // -------------------------------
  return new Response(
`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>MovieZone ShortLink + Token</title>
<style>
body { font-family: sans-serif; text-align:center; padding:50px; }
input[type=text] { width: 60%; padding:10px; font-size:16px; }
button { padding:10px 20px; font-size:16px; margin-left:10px; cursor:pointer; }
#result { margin-top:20px; font-weight:bold; word-break:break-all; }
</style>
</head>
<body>
<h2>MovieZone Token + Extension ShortLink</h2>
<p>Enter any direct MP4 / MKV / image URL:</p>
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
