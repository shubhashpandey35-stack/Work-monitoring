// Classic (non-module) script. Decides where the backend API lives.
// Normal way: open http://localhost:5000/login.html  -> same server, API base is "".
// Live Server (port 5500/5501): backend is on http://localhost:5000.
(function () {
  var devPorts = ["5500", "5501"];
  var base = devPorts.indexOf(location.port) !== -1 ? "http://localhost:5000" : "";
  window.APP_API_URL = base;

  // Dashboard pages need the Socket.IO client library from the backend.
  var me = document.currentScript;
  if (me && me.dataset.socket === "true") {
    document.write('<script src="' + base + '/socket.io/socket.io.js"><\/script>');
  }
})();
