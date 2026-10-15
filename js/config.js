// Classic (non-module) script. Decides where the backend API lives.
//
// 1) Backend + website on the same server  -> open http://localhost:5000/login.html  (API base = "")
// 2) Website opened from Live Server / file:// -> backend is http://localhost:5000
// 3) Website hosted on Netlify (static only)   -> put your deployed backend URL below,
//    e.g. "https://your-backend.onrender.com"  (no trailing slash)
(function () {
  var PRODUCTION_API_URL = ""; // <-- fill this after the backend is deployed (Render etc.)

  var host = location.hostname;
  var isLocal = host === "localhost" || host === "127.0.0.1" || location.protocol === "file:";
  var base = "";

  if (isLocal) {
    // Same server (port 5000) -> ""; any other local origin (Live Server 55xx, Vite 5173, file://) -> backend on 5000.
    var other = location.protocol === "file:" || (location.port && location.port !== "5000");
    base = other ? "http://localhost:5000" : "";
  } else if (PRODUCTION_API_URL) {
    base = PRODUCTION_API_URL.replace(/\/+$/, "");
  }
  window.APP_API_URL = base;

  // Dashboard pages need the Socket.IO client library from the backend.
  var me = document.currentScript;
  if (me && me.dataset.socket === "true") {
    document.write('<script src="' + base + '/socket.io/socket.io.js"><\/script>');
  }
})();
