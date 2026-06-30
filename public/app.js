const $ = (id) => document.getElementById(id);
let donateAddress = "";

const fmt = (n) => Number(n).toLocaleString("en-US");

function setMsg(text, kind) {
  const m = $("msg");
  m.textContent = text;
  m.className = "msg " + (kind || "");
}

async function loadStats() {
  try {
    const s = await (await fetch("/api/stats")).json();
    $("stat-dist").textContent = fmt(s.distributed);
    $("stat-treasury").textContent = fmt(s.treasuryNock);
    $("stat-claims").textContent = fmt(s.claims24h);
  } catch {}
}

async function loadFunding() {
  try {
    const f = await (await fetch("/api/funding")).json();
    $("fund-covered").textContent = "$" + f.coveredUsd.toFixed(2);
    $("fund-cost").textContent = "of $" + f.monthlyCostUsd.toFixed(2) + " / mo";
    $("fund-fill").style.width = f.percent + "%";
    if (f.donateAddress && f.donateAddress !== donateAddress) {
      donateAddress = f.donateAddress;
      $("donate-addr").textContent = donateAddress;
    }
  } catch {}
}

$("claim").addEventListener("submit", async (e) => {
  e.preventDefault();
  const address = $("addr").value.trim();
  const button = e.target.querySelector("button");
  button.disabled = true;
  setMsg("Sending…", "");
  try {
    const res = await fetch("/api/claim", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address }),
    });
    const body = await res.json();
    if (res.ok) {
      setMsg("Sent. tx " + body.txid, "ok");
      loadStats();
    } else if (res.status === 429) {
      setMsg("Already claimed. Try again in " + Math.ceil(body.retryAfter / 3600) + "h.", "err");
    } else if (res.status === 400) {
      setMsg("That doesn't look like a Nockchain address.", "err");
    } else {
      setMsg("Faucet is busy. Try again shortly.", "err");
    }
  } catch {
    setMsg("Network error. Try again.", "err");
  } finally {
    button.disabled = false;
  }
});

$("copy").addEventListener("click", () => {
  if (donateAddress) navigator.clipboard.writeText(donateAddress);
});

loadStats();
loadFunding();
setInterval(loadFunding, 60000);
