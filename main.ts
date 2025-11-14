// main.ts
import { serve } from "https://deno.land/std/http/server.ts";

const kv = await Deno.openKv();

// Random permanent token generator
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
  // 3) HOME PAGE (Styled Web UI + Copy button)
  // -------------------------------
  return new Response(
`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>MovieZone Token + Extension ShortLink</title>
<style>
body {
  font-family: 'Segoe UI', sans-serif;
  background: linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%);
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  margin: 0;
}
.container {
  background: #fff;
  padding: 40px 50px;
  border-radius: 20px;
  box-shadow: 0 15px 30px rgba(0,0,0,0.2);
  text-align: center;
  max-width: 600px;
  width: 90%;
}
h2 {
  color: #333;
  margin-bottom: 20px;
}
input[type=text] {
  width: 80%;
  padding: 15px;
  font-size: 16px;
  border-radius: 10px;
  border: 2px solid #66a6ff;
  outline: none;
  transition: border 0.3s;
}
input[type=text]:focus {
  border-color: #89f7fe;
}
button.generate {
  padding: 15px 25px;
  font-size: 16px;
  margin-left: 10px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(45deg, #66a6ff, #89f7fe);
  color: #fff;
  cursor: pointer;
  transition: transform 0.2s;
}
button.generate:hover {
  transform: scale(1.05);
}
#result {
  margin-top: 25px;
  font-weight: bold;
  word-break: break-all;
  font-size: 16px;
  color: #444;
}
button#copyBtn {
  display: none;
  margin-top: 15px;
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  background: #66a6ff;
  color: #fff;
  cursor: pointer;
  transition: transform 0.2s;
}
button#copyBtn:hover {
  transform: scale(1.05);
}
</style>
</head>
<body>
<div class="container">
<h2>MovieZone Token + Extension ShortLink</h2>
<p>Enter any direct MP4 / MKV / image URL:</p>
<input type="text" id="src" placeholder="https://mediafire.com/xxxx/file.mp4">
<button class="generate" onclick="generate()">Generate</button>
<div id="result"></div>
<button id="copyBtn">Copy Link</button>
</div>
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
  const resultDiv = document.getElementById('result');
  const copyBtn = document.getElementById('copyBtn');
  
  if(data.error) {
    resultDiv.innerText = data.error;
    copyBtn.style.display = 'none';
  } else {
    resultDiv.innerHTML = '<a href="'+data.short+'" target="_blank">'+data.short+'</a>';
    copyBtn.style.display = 'inline-block';
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(data.short).then(()=>alert('Link copied!'));
    };
  }
}
</script>
</body>
</html>
`,
    { headers: { "Content-Type": "text/html" } }
  );
});
